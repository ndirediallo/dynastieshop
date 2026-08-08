"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import { formatZodError } from "@/lib/format-error";
import { stockTransferSchema, type StockTransferInput } from "@/lib/schemas";

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
    details: `Transfert ${transfer.reference} créé (${data.items.length} ligne(s))`,
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
        data: { status: "VALIDE", validatedAt: new Date() },
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
  id: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireModuleAccess("transferts");

  const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
  if (!transfer) return { error: "Transfert introuvable." };
  if (transfer.status !== "EN_ATTENTE") {
    return { error: "Seul un transfert en attente peut être annulé." };
  }

  await prisma.stockTransfer.update({
    where: { id },
    data: { status: "ANNULE" },
  });

  await logActivity({
    userId: user.id,
    action: "TRANSFER_CANCELLED",
    entityType: "StockTransfer",
    entityId: id,
    details: `Transfert ${transfer.reference} annulé (aucun stock déplacé)`,
  });

  revalidatePath(`/transferts/${id}`);
  revalidatePath("/transferts");
  return { success: true, data: { id } };
}
