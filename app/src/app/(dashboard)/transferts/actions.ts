"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import { formatZodError } from "@/lib/format-error";
import {
  stockTransferSchema,
  restockRequestSchema,
  type StockTransferInput,
  type RestockRequestInput,
} from "@/lib/schemas";

type ActionResult<T> = { error: string } | { success: true; data: T };

export async function createStockTransfer(
  input: StockTransferInput
): Promise<ActionResult<{ id: string; reference: string }>> {
  const user = await requireModuleAccess("transferts");
  let data: StockTransferInput;
  try {
    data = stockTransferSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  // Un transfert doit toujours passer par l'entrepôt central : boutique →
  // boutique en direct contournerait la règle posée pour le stock (tout
  // s'organise depuis l'entrepôt). Seuls Entrepôt→Boutique (distribution)
  // et Boutique→Entrepôt (retour de marchandise) sont autorisés.
  const [fromBoutique, toBoutique] = await Promise.all([
    prisma.boutique.findUnique({ where: { id: data.fromBoutiqueId }, select: { type: true } }),
    prisma.boutique.findUnique({ where: { id: data.toBoutiqueId }, select: { type: true } }),
  ]);
  if (!fromBoutique || !toBoutique) {
    return { error: "Boutique d'origine ou de destination introuvable." };
  }
  if (fromBoutique.type === "BOUTIQUE" && toBoutique.type === "BOUTIQUE") {
    return {
      error:
        "Un transfert direct entre deux boutiques n'est pas autorisé : passez par l'entrepôt central.",
    };
  }

  // Un Caissier n'a "transferts" que via un accès supplémentaire — jamais
  // la pleine latitude de Logistique/Super Admin. Le formulaire verrouille
  // déjà origine/destination côté client (voir transfer-form.tsx), mais
  // c'est cette vérification serveur qui empêche réellement un appel
  // direct de créer un transfert vers/depuis une autre boutique.
  if (user.role === "CAISSIER") {
    if (data.fromBoutiqueId !== user.boutiqueId) {
      return { error: "Vous ne pouvez créer un transfert que depuis votre propre boutique." };
    }
    if (toBoutique.type !== "ENTREPOT") {
      return { error: "Vous ne pouvez transférer que vers l'entrepôt central." };
    }
  }

  // Vérification du stock disponible à l'origine dès la création — pas
  // seulement à la confirmation de réception (voir validateStockTransfer).
  // Le formulaire affiche déjà ces quantités, mais un appel direct à cette
  // action ne doit pas pouvoir les contourner.
  const originStocks = await prisma.stock.findMany({
    where: {
      boutiqueId: data.fromBoutiqueId,
      variantId: { in: data.items.map((i) => i.variantId) },
    },
    include: { variant: { include: { product: { select: { name: true } } } } },
  });
  const stockByVariant = new Map(originStocks.map((s) => [s.variantId, s]));
  for (const item of data.items) {
    const stock = stockByVariant.get(item.variantId);
    const available = stock?.quantity ?? 0;
    if (item.quantity > available) {
      const label = stock
        ? `${stock.variant.product.name}${stock.variant.color || stock.variant.size ? ` · ${[stock.variant.color, stock.variant.size].filter(Boolean).join(" / ")}` : ""}`
        : "Ce produit";
      return {
        error:
          available === 0
            ? `${label} n'est pas disponible dans cette boutique. Vérifiez la boutique sélectionnée.`
            : `${label} : stock insuffisant (${available} disponible${available > 1 ? "s" : ""}).`,
      };
    }
  }

  const count = await prisma.stockTransfer.count();
  const reference = `TRF-${String(count + 1).padStart(4, "0")}`;

  const transfer = await prisma.stockTransfer.create({
    data: {
      reference,
      fromBoutiqueId: data.fromBoutiqueId,
      toBoutiqueId: data.toBoutiqueId,
      userId: user.id,
      items: {
        create: data.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      },
    },
  });

  await logActivity({
    userId: user.id,
    action: "TRANSFER_CREATED",
    entityType: "StockTransfer",
    entityId: transfer.id,
    details: `Transfert ${transfer.reference} créé (${data.items.length} ligne${data.items.length > 1 ? "s" : ""})`,
  });

  revalidatePath("/transferts");
  return { success: true, data: { id: transfer.id, reference: transfer.reference } };
}

// Le stock ne bouge qu'ici, jamais à la création (voir §8 du document
// d'architecture) : c'est la confirmation de réception qui matérialise le
// mouvement, dans les deux boutiques, en une seule transaction.
export async function validateStockTransfer(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireModuleAccess("transferts");

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer) return { error: "Transfert introuvable." };
  if (transfer.status !== "EN_ATTENTE") {
    return { error: "Ce transfert a déjà été traité." };
  }
  if (
    user.role === "CAISSIER" &&
    transfer.fromBoutiqueId !== user.boutiqueId &&
    transfer.toBoutiqueId !== user.boutiqueId
  ) {
    return { error: "Ce transfert ne concerne pas votre boutique." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await applyStockMovement(
          {
            boutiqueId: transfer.fromBoutiqueId,
            variantId: item.variantId,
            type: "TRANSFERT_SORTANT",
            quantity: -item.quantity,
            userId: user.id,
            transferId: transfer.id,
          },
          tx
        );
        await applyStockMovement(
          {
            boutiqueId: transfer.toBoutiqueId,
            variantId: item.variantId,
            type: "TRANSFERT_ENTRANT",
            quantity: item.quantity,
            userId: user.id,
            transferId: transfer.id,
          },
          tx
        );
      }
      await tx.stockTransfer.update({
        where: { id },
        data: { status: "VALIDE", validatedAt: new Date(), validatedByUserId: user.id },
      });
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { error: e.message };
    }
    throw e;
  }

  await logActivity({
    userId: user.id,
    action: "TRANSFER_VALIDATED",
    entityType: "StockTransfer",
    entityId: id,
    details: `Transfert ${transfer.reference} validé et réceptionné`,
  });

  revalidatePath(`/transferts/${id}`);
  revalidatePath("/transferts");
  revalidatePath("/stocks");
  revalidatePath("/dashboard");
  return { success: true, data: { id } };
}

export async function cancelStockTransfer(
  id: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireModuleAccess("transferts");

  const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!transfer) return { error: "Transfert introuvable." };
  if (transfer.status !== "EN_ATTENTE") {
    return { error: "Seul un transfert en attente peut être annulé." };
  }
  if (
    user.role === "CAISSIER" &&
    transfer.fromBoutiqueId !== user.boutiqueId &&
    transfer.toBoutiqueId !== user.boutiqueId
  ) {
    return { error: "Ce transfert ne concerne pas votre boutique." };
  }

  const trimmedReason = reason?.trim();
  await prisma.stockTransfer.update({
    where: { id },
    data: {
      status: "ANNULE",
      cancelledAt: new Date(),
      cancelledByUserId: user.id,
      cancelReason: trimmedReason || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "TRANSFER_CANCELLED",
    entityType: "StockTransfer",
    entityId: id,
    details: trimmedReason
      ? `Transfert ${transfer.reference} annulé (aucun stock déplacé), motif : ${trimmedReason}`
      : `Transfert ${transfer.reference} annulé (aucun stock déplacé)`,
  });

  revalidatePath(`/transferts/${id}`);
  revalidatePath("/transferts");
  return { success: true, data: { id } };
}

// Un Caissier n'a pas accès au module "transferts" (voir
// lib/permissions.ts) — il ne peut donc jamais créer de StockTransfer
// lui-même. Ceci est son seul geste face à une rupture dans sa boutique :
// signaler le besoin ; Logistique/Super Admin ravitaillent ensuite en un
// clic (voir fulfillRestockRequest ci-dessous, qui crée ET valide le
// transfert automatiquement).
export async function createRestockRequest(
  input: RestockRequestInput
): Promise<ActionResult<{ id: string; reference: string }>> {
  const user = await requireModuleAccess("produits");
  if (!user.boutiqueId) {
    return { error: "Votre compte n'est rattaché à aucune boutique." };
  }
  let data: RestockRequestInput;
  try {
    data = restockRequestSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const count = await prisma.restockRequest.count();
  const reference = `REA-${String(count + 1).padStart(4, "0")}`;

  const request = await prisma.restockRequest.create({
    data: {
      reference,
      boutiqueId: user.boutiqueId,
      variantId: data.variantId,
      quantity: data.quantity ?? null,
      note: data.note || null,
      requestedByUserId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "RESTOCK_REQUESTED",
    entityType: "RestockRequest",
    entityId: request.id,
    details: `Réapprovisionnement ${reference} demandé`,
  });

  revalidatePath("/produits");
  revalidatePath("/transferts");
  revalidatePath("/dashboard");
  return { success: true, data: { id: request.id, reference } };
}

// Rejette une demande sans aucun mouvement de stock. Réservé à
// Logistique/Super Admin — jamais à un Caissier qui n'aurait "transferts"
// que via un accès supplémentaire limité à sa propre boutique : décider
// pour l'entrepôt (ravitailler ou non une AUTRE boutique) dépasse ce qu'un
// tel accès doit permettre.
export async function rejectRestockRequest(
  id: string,
  resolutionNote?: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");

  const request = await prisma.restockRequest.findUnique({ where: { id } });
  if (!request) return { error: "Demande introuvable." };
  if (request.status !== "EN_ATTENTE") {
    return { error: "Cette demande a déjà été traitée." };
  }

  await prisma.restockRequest.update({
    where: { id },
    data: {
      status: "REJETEE",
      resolvedAt: new Date(),
      resolvedByUserId: user.id,
      resolutionNote: resolutionNote?.trim() || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "RESTOCK_REJECTED",
    entityType: "RestockRequest",
    entityId: id,
    details: `Demande ${request.reference} rejetée${resolutionNote ? ", motif : " + resolutionNote : ""}`,
  });

  revalidatePath("/transferts");
  revalidatePath("/dashboard");
  return { success: true, data: { id } };
}

// Ravitaille la boutique en un clic : plus d'étape manuelle de création de
// transfert (voir discussion avec l'utilisateur — le détour par "Nouveau
// transfert" était trop lent). Ici, le StockTransfer est créé ET validé
// dans la même transaction : le stock de l'entrepôt baisse, celui de la
// boutique augmente, immédiatement.
// Réservé à Logistique/Super Admin, même logique que rejectRestockRequest
// ci-dessus.
export async function fulfillRestockRequest(
  id: string,
  quantity: number
): Promise<ActionResult<{ id: string; transferReference: string }>> {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Indiquez une quantité valide." };
  }

  const request = await prisma.restockRequest.findUnique({
    where: { id },
    include: { variant: { include: { product: { select: { name: true } } } } },
  });
  if (!request) return { error: "Demande introuvable." };
  if (request.status !== "EN_ATTENTE") {
    return { error: "Cette demande a déjà été traitée." };
  }

  const entrepot = await prisma.boutique.findFirst({ where: { type: "ENTREPOT" } });
  if (!entrepot) return { error: "Aucun entrepôt central configuré." };

  try {
    const transfer = await prisma.$transaction(async (tx) => {
      const count = await tx.stockTransfer.count();
      const reference = `TRF-${String(count + 1).padStart(4, "0")}`;
      const now = new Date();

      const created = await tx.stockTransfer.create({
        data: {
          reference,
          fromBoutiqueId: entrepot.id,
          toBoutiqueId: request.boutiqueId,
          userId: user.id,
          status: "VALIDE",
          validatedAt: now,
          validatedByUserId: user.id,
          items: { create: [{ variantId: request.variantId, quantity }] },
        },
      });

      await applyStockMovement(
        {
          boutiqueId: entrepot.id,
          variantId: request.variantId,
          type: "TRANSFERT_SORTANT",
          quantity: -quantity,
          userId: user.id,
          transferId: created.id,
        },
        tx
      );
      await applyStockMovement(
        {
          boutiqueId: request.boutiqueId,
          variantId: request.variantId,
          type: "TRANSFERT_ENTRANT",
          quantity,
          userId: user.id,
          transferId: created.id,
        },
        tx
      );

      await tx.restockRequest.update({
        where: { id },
        data: {
          status: "TRAITEE",
          resolvedAt: now,
          resolvedByUserId: user.id,
          transferId: created.id,
        },
      });

      return created;
    });

    await logActivity({
      userId: user.id,
      action: "RESTOCK_RESOLVED",
      entityType: "RestockRequest",
      entityId: id,
      details: `Demande ${request.reference} ravitaillée automatiquement via le transfert ${transfer.reference} (${quantity} × ${request.variant.product.name})`,
    });

    revalidatePath("/transferts");
    revalidatePath("/stocks");
    revalidatePath("/produits");
    revalidatePath("/dashboard");
    return { success: true, data: { id, transferReference: transfer.reference } };
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return {
        error: `Stock insuffisant à l'entrepôt pour ${request.variant.product.name} (${quantity} demandé${quantity > 1 ? "s" : ""}).`,
      };
    }
    throw e;
  }
}
