"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement } from "@/lib/stock";
import { formatZodError } from "@/lib/format-error";
import {
  supplierSchema,
  purchaseOrderSchema,
  receivePurchaseOrderSchema,
  supplierPaymentSchema,
  type SupplierInput,
  type PurchaseOrderInput,
  type ReceivePurchaseOrderInput,
  type SupplierPaymentInput,
} from "@/lib/schemas";

type ActionResult<T> = { error: string } | { success: true; data: T };

// Le montant dû sur une commande n'est jamais stocké : toujours recalculé à
// partir des lignes réellement reçues (voir le commentaire sur le modèle
// `SupplierPayment` dans schema.prisma).
function purchaseOrderOwed(items: { unitCost: unknown; quantityReceived: number }[]) {
  return items.reduce((sum, item) => sum + Number(item.unitCost) * item.quantityReceived, 0);
}

export async function createSupplier(input: SupplierInput) {
  const user = await requireModuleAccess("fournisseurs");
  const data = supplierSchema.parse(input);

  const supplier = await prisma.supplier.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "SUPPLIER_CREATED",
    entityType: "Supplier",
    entityId: supplier.id,
    details: `Fournisseur "${supplier.name}" créé`,
  });

  revalidatePath("/fournisseurs");
  return supplier;
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const user = await requireModuleAccess("fournisseurs");
  const data = supplierSchema.parse(input);

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "SUPPLIER_UPDATED",
    entityType: "Supplier",
    entityId: supplier.id,
    details: `Fournisseur "${supplier.name}" modifié`,
  });

  revalidatePath("/fournisseurs");
  return supplier;
}

// La création d'une commande engage l'entreprise financièrement : réservée
// au Super Admin (décision validée — voir document d'architecture, §5).
export async function createPurchaseOrder(input: PurchaseOrderInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = purchaseOrderSchema.parse(input);

  // La marchandise commandée est toujours réceptionnée dans l'entrepôt
  // central ; les boutiques ne sont approvisionnées que par transfert.
  const boutique = await prisma.boutique.findUnique({
    where: { id: data.boutiqueId },
    select: { type: true },
  });
  if (!boutique || boutique.type !== "ENTREPOT") {
    throw new Error(
      "Les commandes ne peuvent être destinées qu'à l'entrepôt central."
    );
  }

  const count = await prisma.purchaseOrder.count();
  const reference = `CMD-${String(count + 1).padStart(4, "0")}`;

  const order = await prisma.purchaseOrder.create({
    data: {
      reference,
      supplierId: data.supplierId,
      boutiqueId: data.boutiqueId,
      status: "ENVOYEE",
      userId: user.id,
      items: {
        create: data.items.map((i) => ({
          variantId: i.variantId,
          quantityOrdered: i.quantityOrdered,
          unitCost: i.unitCost,
        })),
      },
    },
  });

  await logActivity({
    userId: user.id,
    action: "PURCHASE_ORDER_CREATED",
    entityType: "PurchaseOrder",
    entityId: order.id,
    details: `Commande ${order.reference} créée (${data.items.length} ligne${data.items.length > 1 ? "s" : ""})`,
  });

  revalidatePath("/fournisseurs/commandes");
  return order;
}

// Annuler une commande n'a de sens que tant que rien n'a encore été reçu —
// dès qu'une réception a eu lieu, la marchandise existe physiquement dans
// l'entrepôt et le statut RECUE_PARTIELLE/RECUE_TOTALE reflète déjà la
// réalité (annuler à ce stade effacerait une entrée de stock bien réelle).
// Réservée au Super Admin, comme la création (même engagement financier).
export async function cancelPurchaseOrder(
  purchaseOrderId: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("SUPER_ADMIN");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (!order) return { error: "Commande introuvable." };
  if (order.status === "ANNULEE") {
    return { error: "Cette commande est déjà annulée." };
  }
  const hasReceived = order.items.some((item) => item.quantityReceived > 0);
  if (hasReceived) {
    return {
      error:
        "Cette commande a déjà été reçue (au moins partiellement) et ne peut plus être annulée.",
    };
  }

  const trimmedReason = reason?.trim();
  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      status: "ANNULEE",
      cancelledAt: new Date(),
      cancelledByUserId: user.id,
      cancelReason: trimmedReason || null,
    },
  });

  await logActivity({
    userId: user.id,
    action: "PURCHASE_ORDER_CANCELLED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrderId,
    details: trimmedReason
      ? `Commande ${order.reference} annulée, motif : ${trimmedReason}`
      : `Commande ${order.reference} annulée`,
  });

  revalidatePath(`/fournisseurs/commandes/${purchaseOrderId}`);
  revalidatePath("/fournisseurs/commandes");
  return { success: true, data: { id: purchaseOrderId } };
}

// Suppression définitive — distincte de l'annulation : l'annulation garde
// une trace (statut ANNULEE, motif, qui/quand), la suppression efface la
// commande de la liste. Autorisée seulement si rien n'a encore été reçu :
// une réception crée un StockMovement indépendant (RECEPTION_ACHAT) qui ne
// pointe pas vers la commande et ne serait donc jamais nettoyé en cascade —
// supprimer une commande déjà (même partiellement) reçue laisserait du
// stock réel sans aucune trace de sa provenance. Les lignes et paiements
// liés disparaissent en cascade (voir schema.prisma, onDelete: Cascade).
export async function deletePurchaseOrder(
  purchaseOrderId: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("SUPER_ADMIN");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (!order) return { error: "Commande introuvable." };
  const hasReceived = order.items.some((item) => item.quantityReceived > 0);
  if (hasReceived) {
    return {
      error:
        "Cette commande a déjà été reçue (au moins partiellement) et ne peut plus être supprimée. Annulez-la si besoin, mais le stock déjà entré doit garder sa trace.",
    };
  }

  await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } });

  await logActivity({
    userId: user.id,
    action: "PURCHASE_ORDER_DELETED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrderId,
    details: `Commande ${order.reference} supprimée définitivement`,
  });

  revalidatePath("/fournisseurs/commandes");
  revalidatePath("/fournisseurs");
  return { success: true, data: { id: purchaseOrderId } };
}

// La réception physique est réservée à Logistique/Super Admin : recevoir de
// la marchandise dans l'entrepôt central n'a pas de version "limitée à ma
// boutique" sensée (voir note sur /stocks et /transferts — même principe :
// pas de version scoped possible, donc verrou de rôle plutôt qu'un simple
// accès au module, qui donnerait à un Caissier avec l'accès "fournisseurs"
// le pouvoir de modifier le stock de l'entrepôt entier).
export async function receivePurchaseOrder(
  purchaseOrderId: string,
  input: ReceivePurchaseOrderInput
) {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");
  const data = receivePurchaseOrderSchema.parse(input);

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });
  if (!order) throw new Error("Commande introuvable");
  if (order.status === "RECUE_TOTALE" || order.status === "ANNULEE") {
    throw new Error("Cette commande ne peut plus être réceptionnée.");
  }

  const linesToApply = data.lines.filter((l) => l.quantityReceivedNow > 0);

  await prisma.$transaction(async (tx) => {
    for (const line of linesToApply) {
      const item = order.items.find((i) => i.id === line.itemId);
      if (!item) continue;

      const newReceived = Math.min(
        item.quantityReceived + line.quantityReceivedNow,
        item.quantityOrdered
      );

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: newReceived },
      });

      await applyStockMovement(
        {
          boutiqueId: order.boutiqueId,
          variantId: item.variantId,
          type: "RECEPTION_ACHAT",
          quantity: newReceived - item.quantityReceived,
          userId: user.id,
        },
        tx
      );
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
    });
    const fullyReceived = updatedItems.every(
      (i) => i.quantityReceived >= i.quantityOrdered
    );
    const partiallyReceived = updatedItems.some((i) => i.quantityReceived > 0);

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: fullyReceived
          ? "RECUE_TOTALE"
          : partiallyReceived
            ? "RECUE_PARTIELLE"
            : order.status,
      },
    });
  });

  await logActivity({
    userId: user.id,
    action: "PURCHASE_ORDER_RECEIVED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrderId,
    details: `Réception enregistrée sur la commande ${order.reference}`,
  });

  revalidatePath(`/fournisseurs/commandes/${purchaseOrderId}`);
  revalidatePath("/fournisseurs/commandes");
  revalidatePath("/stocks");
  revalidatePath("/dashboard");
}

// Un paiement fournisseur est un simple ajout, à l'image d'un remboursement
// de crédit côté client (voir credits/actions.ts) — aucune autre donnée ne
// bouge, le solde se recalcule à la volée à partir de tous les paiements.
// Réservé à Logistique/Super Admin, même raisonnement que receivePurchaseOrder
// ci-dessus : payer un fournisseur est un engagement financier de
// l'entreprise entière, pas une action "limitée à ma boutique".
export async function recordSupplierPayment(
  purchaseOrderId: string,
  input: SupplierPaymentInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("SUPER_ADMIN", "LOGISTIQUE");
  let data: SupplierPaymentInput;
  try {
    data = supplierPaymentSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true, payments: true },
  });
  if (!order) {
    return { error: "Commande fournisseur introuvable." };
  }

  const owed = purchaseOrderOwed(order.items);
  const paidSoFar = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.round((owed - paidSoFar) * 100) / 100;
  if (balance <= 0) {
    return { error: "Cette commande est déjà intégralement payée." };
  }
  if (data.amount > balance + 0.01) {
    return { error: `Le montant dépasse le solde restant dû (${balance}).` };
  }

  const payment = await prisma.supplierPayment.create({
    data: { purchaseOrderId, method: data.method, amount: data.amount, userId: user.id },
  });

  await logActivity({
    userId: user.id,
    action: "SUPPLIER_PAYMENT",
    entityType: "PurchaseOrder",
    entityId: purchaseOrderId,
    details: `Paiement de ${data.amount} enregistré sur la commande ${order.reference}`,
  });

  revalidatePath(`/fournisseurs/commandes/${purchaseOrderId}`);
  revalidatePath("/fournisseurs/commandes");
  revalidatePath("/fournisseurs/dettes");
  revalidatePath("/fournisseurs");
  return { success: true, data: { id: payment.id } };
}
