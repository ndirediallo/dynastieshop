"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import { formatZodError } from "@/lib/format-error";
import { getSettings } from "@/lib/settings";
import {
  saleSchema,
  saleReturnSchema,
  saleEditRequestSchema,
  updateSaleItemSchema,
  type SaleInput,
  type SaleReturnInput,
  type SaleEditRequestInput,
  type UpdateSaleItemInput,
} from "@/lib/schemas";

type ActionResult<T> = { error: string } | { success: true; data: T };

export async function createSale(
  input: SaleInput
): Promise<ActionResult<{ id: string; reference: string }>> {
  const user = await requireModuleAccess("ventes");
  let data: SaleInput;
  try {
    data = saleSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  // Une vente ne peut être enregistrée que sur une boutique (jamais sur
  // l'entrepôt central, qui ne fait pas de caisse). La page Caisse filtre
  // déjà ses options, mais cette vérification serveur est la seule qui
  // compte réellement — un appel direct à cette action ne doit pas pouvoir
  // la contourner.
  const targetBoutique = await prisma.boutique.findUnique({
    where: { id: data.boutiqueId },
    select: { type: true },
  });
  if (!targetBoutique || targetBoutique.type !== "BOUTIQUE") {
    return { error: "Les ventes ne peuvent être enregistrées que sur une boutique, pas sur l'entrepôt." };
  }

  // Un Caissier (ou un Logistique avec "ventes" en accès supplémentaire)
  // ne peut vendre que depuis sa propre boutique — la page Caisse ne lui
  // propose déjà que celle-ci, mais sans cette vérification un appel
  // direct à cette action pourrait enregistrer une vente sur une autre
  // boutique que la sienne. Le Super Admin reste libre.
  if (user.role !== "SUPER_ADMIN" && data.boutiqueId !== user.boutiqueId) {
    return { error: "Vous ne pouvez enregistrer une vente que sur votre boutique assignée." };
  }

  const itemsTotal = data.items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice - i.discount,
    0
  );
  // Frais de livraison : s'ajoute au panier pour former ce qui est
  // réellement encaissé (voir Prisma schema, Sale.deliveryFee) — les
  // paiements doivent donc couvrir itemsTotal + deliveryFee, pas itemsTotal
  // seul, sans quoi une vente avec livraison paraîtrait toujours en écart.
  const deliveryFee = data.deliveryFee ?? 0;
  const saleTotal = itemsTotal + deliveryFee;
  const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDiscount = data.items.reduce((sum, i) => sum + i.discount, 0);
  const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // Plafond de remise (Paramètres → Remises en Caisse) : ne s'applique
  // jamais au Super Admin, toujours libre d'appliquer la remise qu'il
  // juge nécessaire — seul un Caissier (ou un Logistique avec "ventes" en
  // accès supplémentaire) est concerné. Revérifié ici, pas seulement côté
  // Caisse : un appel direct à cette action ne doit pas pouvoir contourner
  // le plafond affiché à l'écran.
  if (user.role !== "SUPER_ADMIN" && subtotal > 0) {
    const settings = await getSettings();
    const discountPct = (totalDiscount / subtotal) * 100;
    if (discountPct > settings.maxDiscountPercent + 0.01) {
      return {
        error: `La remise (${discountPct.toFixed(0)}%) dépasse le maximum autorisé (${settings.maxDiscountPercent}%). Demandez au Super Admin d'enregistrer cette vente.`,
      };
    }
  }

  // Une vente normale doit être payée intégralement à la caisse (tolérance
  // d'arrondi plutôt qu'égalité stricte sur des nombres flottants). Une
  // vente à crédit autorise un paiement partiel, voire nul — le manquant
  // devient le solde dû, remboursable plus tard via /credits (schema.ts
  // garantit déjà qu'un client est attaché dans ce cas).
  if (data.isCredit) {
    if (paymentsTotal > saleTotal + 0.01) {
      return {
        error: `L'acompte (${paymentsTotal}) ne peut pas dépasser le total du panier (${saleTotal}).`,
      };
    }
  } else if (Math.abs(saleTotal - paymentsTotal) > 0.01) {
    return {
      error: `Le total des paiements (${paymentsTotal}) ne correspond pas au total du panier (${saleTotal}).`,
    };
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const settings = await tx.settings.findFirst();
      const reference = settings
        ? `${settings.ticketPrefix}-${String(settings.ticketNextNumber).padStart(6, "0")}`
        : `TCK-${Date.now()}`;

      if (settings) {
        await tx.settings.update({
          where: { id: settings.id },
          data: { ticketNextNumber: { increment: 1 } },
        });
      }

      const createdSale = await tx.sale.create({
        data: {
          reference,
          boutiqueId: data.boutiqueId,
          customerId: data.customerId || null,
          userId: user.id,
          discount: totalDiscount,
          totalAmount: saleTotal,
          deliveryFee,
          isCredit: data.isCredit,
          items: {
            create: data.items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
            })),
          },
          payments: {
            create: data.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference || null,
              userId: user.id,
            })),
          },
        },
      });

      for (const item of data.items) {
        await applyStockMovement(
          {
            boutiqueId: data.boutiqueId,
            variantId: item.variantId,
            type: "VENTE",
            quantity: -item.quantity,
            userId: user.id,
          },
          tx
        );
      }

      return createdSale;
    });

    await logActivity({
      userId: user.id,
      action: "SALE_CREATED",
      entityType: "Sale",
      entityId: sale.id,
      details: data.isCredit
        ? `Vente à crédit ${sale.reference} enregistrée pour un total de ${saleTotal}${deliveryFee > 0 ? ` (dont livraison : ${deliveryFee})` : ""} (acompte : ${paymentsTotal})`
        : `Vente ${sale.reference} enregistrée pour un total de ${saleTotal}${deliveryFee > 0 ? ` (dont livraison : ${deliveryFee})` : ""}`,
    });

    revalidatePath("/ventes");
    revalidatePath("/credits");
    revalidatePath("/stocks");
    revalidatePath("/dashboard");
    return { success: true, data: { id: sale.id, reference: sale.reference } };
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { error: e.message };
    }
    throw e;
  }
}

export async function createReturn(
  input: SaleReturnInput
): Promise<ActionResult<{ id: string }>> {
  // Réservé au Super Admin (voir document d'architecture, §5) : un Caissier
  // qui pourrait vendre ET rembourser pourrait empocher l'argent d'une
  // fausse correction sans contrôle. Un Caissier passe par une
  // SaleEditRequest (voir createSaleEditRequest ci-dessous), que seul le
  // Super Admin instruit avec ce même mécanisme de retour.
  const user = await requireRole("SUPER_ADMIN");
  let data: SaleReturnInput;
  try {
    data = saleReturnSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const saleItems = await prisma.saleItem.findMany({
    where: { id: { in: data.items.map((i) => i.saleItemId) } },
    include: {
      sale: { select: { id: true, boutiqueId: true } },
      returnItems: { select: { quantity: true } },
    },
  });

  // Le montant remboursé est calculé ici, jamais fourni par le client — au
  // prix net déjà consenti sur la vente (remise de ligne répartie au
  // prorata), pas au prix catalogue.
  let refundAmount = 0;
  for (const requested of data.items) {
    const saleItem = saleItems.find((si) => si.id === requested.saleItemId);
    if (!saleItem || saleItem.sale.id !== data.saleId) {
      return { error: "Article introuvable pour cette vente." };
    }
    const alreadyReturned = saleItem.returnItems.reduce(
      (sum, r) => sum + r.quantity,
      0
    );
    if (alreadyReturned + requested.quantity > saleItem.quantity) {
      return {
        error: `Quantité de retour trop élevée pour un article (déjà retourné : ${alreadyReturned}/${saleItem.quantity}).`,
      };
    }
    const netUnitPrice =
      Number(saleItem.unitPrice) - Number(saleItem.discount) / saleItem.quantity;
    refundAmount += netUnitPrice * requested.quantity;
  }
  refundAmount = Math.round(refundAmount * 100) / 100;

  try {
    const saleReturn = await prisma.$transaction(async (tx) => {
      const created = await tx.saleReturn.create({
        data: {
          saleId: data.saleId,
          userId: user.id,
          reason: data.reason,
          refundAmount,
          refundMethod: data.asStoreCredit ? null : data.refundMethod,
          asStoreCredit: data.asStoreCredit,
          items: {
            create: data.items.map((i) => ({
              saleItemId: i.saleItemId,
              quantity: i.quantity,
            })),
          },
        },
      });

      for (const item of data.items) {
        const saleItem = saleItems.find((si) => si.id === item.saleItemId)!;
        await applyStockMovement(
          {
            boutiqueId: saleItem.sale.boutiqueId,
            variantId: saleItem.variantId,
            type: "RETOUR_VENTE",
            quantity: item.quantity,
            userId: user.id,
          },
          tx
        );
      }

      return created;
    });

    await logActivity({
      userId: user.id,
      action: "SALE_RETURN_CREATED",
      entityType: "Sale",
      entityId: data.saleId,
      details: `Retour enregistré sur la vente : ${refundAmount} ${
        data.asStoreCredit ? "en avoir" : `remboursés (${data.refundMethod})`
      }${data.reason ? ", motif : " + data.reason : ""}`,
    });

    revalidatePath(`/ventes/${data.saleId}`);
    revalidatePath("/stocks");
    revalidatePath("/dashboard");
    return { success: true, data: { id: saleReturn.id } };
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return { error: e.message };
    }
    throw e;
  }
}

// Ce qu'un Caissier peut faire face à une erreur sur une vente qu'il a
// enregistrée : signaler le problème, jamais le corriger lui-même (voir
// createReturn ci-dessus). N'importe qui ayant accès à "ventes" peut
// l'ouvrir — y compris un Super Admin qui voudrait documenter une demande
// avant de la traiter.
export async function createSaleEditRequest(
  input: SaleEditRequestInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireModuleAccess("ventes");
  let data: SaleEditRequestInput;
  try {
    data = saleEditRequestSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const sale = await prisma.sale.findUnique({ where: { id: data.saleId }, select: { reference: true } });
  if (!sale) return { error: "Vente introuvable." };

  const request = await prisma.saleEditRequest.create({
    data: {
      saleId: data.saleId,
      reason: data.reason,
      requestedByUserId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "SALE_EDIT_REQUESTED",
    entityType: "Sale",
    entityId: data.saleId,
    details: `Correction demandée sur la vente ${sale.reference} : ${data.reason}`,
  });

  revalidatePath(`/ventes/${data.saleId}`);
  revalidatePath("/dashboard");
  return { success: true, data: { id: request.id } };
}

// Seul le Super Admin instruit une demande — il ne s'agit que de
// l'acter/la refuser ici ; la correction elle-même, si approuvée, se fait
// avec createReturn comme n'importe quel retour normal (voir discussion
// avec l'utilisateur : la validation reste un acte humain, pas une
// application automatique d'un changement demandé par le Caissier).
export async function resolveSaleEditRequest(
  id: string,
  approve: boolean,
  resolutionNote?: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("SUPER_ADMIN");

  const request = await prisma.saleEditRequest.findUnique({
    where: { id },
    include: { sale: { select: { reference: true, id: true } } },
  });
  if (!request) return { error: "Demande introuvable." };
  if (request.status !== "EN_ATTENTE") {
    return { error: "Cette demande a déjà été traitée." };
  }

  await prisma.saleEditRequest.update({
    where: { id },
    data: {
      status: approve ? "TRAITEE" : "REJETEE",
      resolvedAt: new Date(),
      resolvedByUserId: user.id,
      resolutionNote: resolutionNote?.trim() || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: approve ? "SALE_EDIT_APPROVED" : "SALE_EDIT_REJECTED",
    entityType: "Sale",
    entityId: request.saleId,
    details: `Demande de correction sur ${request.sale.reference} ${approve ? "approuvée" : "rejetée"}${
      resolutionNote ? ", motif : " + resolutionNote : ""
    }`,
  });

  revalidatePath(`/ventes/${request.saleId}`);
  revalidatePath("/dashboard");
  return { success: true, data: { id } };
}

// Correction directe d'une ligne de vente (quantité et/ou prix) — réservée
// au Super Admin (voir document d'architecture, §5 : même logique de
// contrôle que createReturn, un Caissier ne doit jamais pouvoir modifier ce
// qu'il a lui-même enregistré). Le total de la vente est toujours
// RECALCULÉ à partir de toutes les lignes, jamais ajusté par un delta — il
// ne peut donc jamais diverger de la somme réelle, et le CA du mois (lu en
// direct depuis Sale.totalAmount partout — dashboard, rapports) reflète la
// correction sans aucune étape supplémentaire.
export async function updateSaleItem(
  saleItemId: string,
  input: UpdateSaleItemInput
): Promise<ActionResult<{ saleId: string }>> {
  const user = await requireRole("SUPER_ADMIN");
  let data: UpdateSaleItemInput;
  try {
    data = updateSaleItemSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const item = await prisma.saleItem.findUnique({
    where: { id: saleItemId },
    include: {
      sale: { select: { id: true, boutiqueId: true, reference: true, deliveryFee: true } },
      returnItems: { select: { quantity: true } },
      variant: { include: { product: { select: { name: true } } } },
    },
  });
  if (!item) return { error: "Article introuvable." };

  const alreadyReturned = item.returnItems.reduce((sum, r) => sum + r.quantity, 0);
  if (data.quantity < alreadyReturned) {
    return {
      error: `Impossible : ${alreadyReturned} unité(s) déjà retournée(s) sur cet article. La quantité ne peut pas descendre en dessous.`,
    };
  }

  const deltaQty = data.quantity - item.quantity;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.saleItem.update({
        where: { id: saleItemId },
        data: { quantity: data.quantity, unitPrice: data.unitPrice },
      });

      // Vendre plus qu'avant retire du stock supplémentaire ; vendre moins
      // en restitue — un seul mouvement signé couvre les deux sens.
      if (deltaQty !== 0) {
        await applyStockMovement(
          {
            boutiqueId: item.sale.boutiqueId,
            variantId: item.variantId,
            type: "AJUSTEMENT",
            quantity: -deltaQty,
            userId: user.id,
            reason: `Correction manuelle de la vente ${item.sale.reference} par le Super Admin`,
          },
          tx
        );
      }

      const allItems = await tx.saleItem.findMany({ where: { saleId: item.sale.id } });
      const itemsTotal = allItems.reduce(
        (sum, i) => sum + i.quantity * Number(i.unitPrice) - Number(i.discount),
        0
      );
      // Les frais de livraison ne changent pas ici (seules les lignes de
      // vente sont corrigées) — il faut quand même les réintégrer, sinon ce
      // recalcul total "à partir des lignes" les ferait disparaître du
      // total de la vente.
      const newTotal = itemsTotal + Number(item.sale.deliveryFee);
      const newDiscount = allItems.reduce((sum, i) => sum + Number(i.discount), 0);
      await tx.sale.update({
        where: { id: item.sale.id },
        data: { totalAmount: newTotal, discount: newDiscount },
      });
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return {
        error: `Stock insuffisant pour porter la quantité de ${item.variant.product.name} à ${data.quantity}.`,
      };
    }
    throw e;
  }

  await logActivity({
    userId: user.id,
    action: "SALE_ITEM_EDITED",
    entityType: "Sale",
    entityId: item.sale.id,
    details: `Ligne "${item.variant.product.name}" de la vente ${item.sale.reference} modifiée : quantité ${item.quantity} → ${data.quantity}, prix unitaire ${item.unitPrice} → ${data.unitPrice}`,
  });

  revalidatePath(`/ventes/${item.sale.id}`);
  revalidatePath("/ventes/historique");
  revalidatePath("/stocks");
  revalidatePath("/rapports");
  revalidatePath("/dashboard");
  return { success: true, data: { saleId: item.sale.id } };
}
