"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import { formatZodError } from "@/lib/format-error";
import {
  stockMovementSchema,
  inventorySchema,
  quickRestockSchema,
  type StockMovementInput,
  type InventoryInput,
  type QuickRestockInput,
} from "@/lib/schemas";

type ActionResult = { error: string } | { success: true };

// Réservé à Logistique/Super Admin : vise l'entrepôt central, une
// ressource partagée entre toutes les boutiques — pas d'usage légitime pour
// un Caissier dont l'accès "stocks" (toujours accordé en plus de son rôle)
// est limité à sa propre boutique.
export async function createManualMovement(
  input: StockMovementInput
): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");
  const data = stockMovementSchema.parse(input);
  const signedQuantity = data.type === "SORTIE" ? -data.quantity : data.quantity;

  // Toute nouvelle marchandise doit d'abord entrer dans l'entrepôt central ;
  // une boutique ne reçoit du stock que par transfert (voir transferts/).
  const boutique = await prisma.boutique.findUnique({
    where: { id: data.boutiqueId },
    select: { type: true },
  });
  if (!boutique || boutique.type !== "ENTREPOT") {
    return {
      error:
        "Les mouvements manuels ne sont autorisés que sur l'entrepôt central. Utilisez un transfert pour approvisionner une boutique.",
    };
  }

  try {
    await applyStockMovement({
      boutiqueId: data.boutiqueId,
      variantId: data.variantId,
      type: data.type,
      quantity: signedQuantity,
      reason: data.reason,
      userId: user.id,
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { error: e.message };
    }
    throw e;
  }

  await logActivity({
    userId: user.id,
    action: data.type === "ENTREE" ? "STOCK_ENTREE" : "STOCK_SORTIE",
    entityType: "Stock",
    entityId: data.variantId,
    details: `${data.type === "ENTREE" ? "Entrée" : "Sortie"} manuelle de ${data.quantity} unité(s)${data.reason ? ", motif : " + data.reason : ""}`,
  });

  revalidatePath("/stocks");
  revalidatePath("/dashboard");
  return { success: true };
}

// Raccourci "Envoyer vers une boutique" : au lieu d'aller créer un transfert
// puis revenir plus tard en confirmer la réception (deux pages, deux
// étapes), ce raccourci fait les deux à la fois — le transfert est créé
// directement à l'état "VALIDE". On garde quand même une vraie ligne
// StockTransfer pour l'historique dans /transferts, seule l'attente entre
// création et confirmation disparaît.
// Même restriction que createManualMovement ci-dessus — décide pour
// l'entrepôt au profit d'une boutique quelconque, pas limité à "la mienne".
export async function quickRestockBoutique(
  input: QuickRestockInput
): Promise<ActionResult> {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");
  let data: QuickRestockInput;
  try {
    data = quickRestockSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const entrepot = await prisma.boutique.findFirst({ where: { type: "ENTREPOT" } });
  if (!entrepot) {
    return { error: "Aucun entrepôt configuré." };
  }
  const destination = await prisma.boutique.findUnique({
    where: { id: data.toBoutiqueId },
    select: { type: true },
  });
  if (!destination || destination.type !== "BOUTIQUE") {
    return { error: "La destination doit être une boutique." };
  }

  const count = await prisma.stockTransfer.count();
  const reference = `TRF-${String(count + 1).padStart(4, "0")}`;

  try {
    await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          reference,
          fromBoutiqueId: entrepot.id,
          toBoutiqueId: data.toBoutiqueId,
          userId: user.id,
          status: "VALIDE",
          validatedAt: new Date(),
          items: { create: [{ variantId: data.variantId, quantity: data.quantity }] },
        },
      });

      await applyStockMovement(
        {
          boutiqueId: entrepot.id,
          variantId: data.variantId,
          type: "TRANSFERT_SORTANT",
          quantity: -data.quantity,
          userId: user.id,
          transferId: transfer.id,
        },
        tx
      );
      await applyStockMovement(
        {
          boutiqueId: data.toBoutiqueId,
          variantId: data.variantId,
          type: "TRANSFERT_ENTRANT",
          quantity: data.quantity,
          userId: user.id,
          transferId: transfer.id,
        },
        tx
      );
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
    entityId: reference,
    details: `Envoi rapide ${reference} : ${data.quantity} unité(s) vers une boutique`,
  });

  revalidatePath("/stocks");
  revalidatePath("/transferts");
  revalidatePath("/dashboard");
  return { success: true };
}

// Un inventaire compare la quantité comptée physiquement à la quantité
// théorique. Toutes les lignes comptées sont conservées dans une
// `InventorySession` (photo complète, pour l'historique et le reçu PDF),
// mais seules celles qui diffèrent génèrent un mouvement INVENTAIRE (le
// delta, positif ou négatif). Toute la session est validée en une seule
// transaction.
// Même restriction — un inventaire porte sur une boutique au choix de
// l'appelant (voir data.boutiqueId plus bas), jamais verrouillé à "la
// mienne" pour un Caissier.
export async function submitInventory(
  input: InventoryInput
): Promise<{ error: string } | { success: true; sessionId: string }> {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");
  const data = inventorySchema.parse(input);

  const currentStocks = await prisma.stock.findMany({
    where: {
      boutiqueId: data.boutiqueId,
      variantId: { in: data.lines.map((l) => l.variantId) },
    },
  });
  const currentByVariant = new Map(currentStocks.map((s) => [s.variantId, s.quantity]));

  const allLines = data.lines.map((line) => {
    const theoreticalQuantity = currentByVariant.get(line.variantId) ?? 0;
    return {
      ...line,
      theoreticalQuantity,
      delta: line.countedQuantity - theoreticalQuantity,
    };
  });
  const changedLines = allLines.filter((line) => line.delta !== 0);

  const count = await prisma.inventorySession.count();
  const reference = `INV-${String(count + 1).padStart(4, "0")}`;

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.inventorySession.create({
      data: {
        reference,
        boutiqueId: data.boutiqueId,
        userId: user.id,
        lineCount: allLines.length,
        changeCount: changedLines.length,
        lines: {
          create: allLines.map((line) => ({
            variantId: line.variantId,
            theoreticalQuantity: line.theoreticalQuantity,
            countedQuantity: line.countedQuantity,
            delta: line.delta,
          })),
        },
      },
    });

    for (const line of changedLines) {
      await applyStockMovement(
        {
          boutiqueId: data.boutiqueId,
          variantId: line.variantId,
          type: "INVENTAIRE",
          quantity: line.delta,
          reason: `Ajustement suite à inventaire ${reference}`,
          userId: user.id,
        },
        tx
      );
    }

    return created;
  });

  await logActivity({
    userId: user.id,
    action: "STOCK_INVENTAIRE",
    entityType: "InventorySession",
    entityId: session.id,
    details: `Inventaire ${reference} réalisé : ${allLines.length} produit${allLines.length > 1 ? "s" : ""} compté${allLines.length > 1 ? "s" : ""}, ${changedLines.length} ajusté${changedLines.length > 1 ? "s" : ""}`,
  });

  revalidatePath("/stocks");
  revalidatePath("/stocks/inventaire/historique");
  revalidatePath("/dashboard");
  return { success: true, sessionId: session.id };
}
