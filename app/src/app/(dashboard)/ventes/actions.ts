"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import { formatZodError } from "@/lib/format-error";
import {
  saleSchema,
  saleReturnSchema,
  type SaleInput,
  type SaleReturnInput,
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

  const itemsTotal = data.items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice - i.discount,
    0
  );
  const paymentsTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDiscount = data.items.reduce((sum, i) => sum + i.discount, 0);

  // Une petite tolérance d'arrondi (centimes) plutôt qu'une égalité stricte
  // sur des nombres flottants.
  if (Math.abs(itemsTotal - paymentsTotal) > 0.01) {
    return {
      error: `Le total des paiements (${paymentsTotal}) ne correspond pas au total du panier (${itemsTotal}).`,
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
          totalAmount: itemsTotal,
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
      details: `Vente ${sale.reference} enregistrée pour un total de ${itemsTotal}`,
    });

    revalidatePath("/ventes");
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
  const user = await requireModuleAccess("ventes");
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
  }

  try {
    const saleReturn = await prisma.$transaction(async (tx) => {
      const created = await tx.saleReturn.create({
        data: {
          saleId: data.saleId,
          userId: user.id,
          reason: data.reason,
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
      details: `Retour enregistré sur la vente${data.reason ? " — " + data.reason : ""}`,
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
