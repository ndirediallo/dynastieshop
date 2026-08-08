"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement } from "@/lib/stock";
import {
  supplierSchema,
  purchaseOrderSchema,
  receivePurchaseOrderSchema,
  type SupplierInput,
  type PurchaseOrderInput,
  type ReceivePurchaseOrderInput,
} from "@/lib/schemas";

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
    details: `Commande ${order.reference} créée (${data.items.length} ligne(s))`,
  });

  revalidatePath("/fournisseurs/commandes");
  return order;
}

// La réception physique (rôle Logistique ou Super Admin) met à jour le
// stock de la boutique/entrepôt de destination et le statut de la
// commande automatiquement (partielle ou totale selon ce qui reste).
export async function receivePurchaseOrder(
  purchaseOrderId: string,
  input: ReceivePurchaseOrderInput
) {
  const user = await requireModuleAccess("fournisseurs");
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
