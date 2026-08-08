"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import {
  stockMovementSchema,
  inventorySchema,
  type StockMovementInput,
  type InventoryInput,
} from "@/lib/schemas";

type ActionResult = { error: string } | { success: true };

export async function createManualMovement(
  input: StockMovementInput
): Promise<ActionResult> {
  const user = await requireModuleAccess("stocks");
  const data = stockMovementSchema.parse(input);
  const signedQuantity = data.type === "SORTIE" ? -data.quantity : data.quantity;

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
    details: `${data.type === "ENTREE" ? "Entrée" : "Sortie"} manuelle de ${data.quantity} unité(s)${data.reason ? " — " + data.reason : ""}`,
  });

  revalidatePath("/stocks");
  revalidatePath("/dashboard");
  return { success: true };
}

// Un inventaire compare la quantité comptée physiquement à la quantité
// théorique : seules les lignes qui diffèrent génèrent un mouvement
// AJUSTEMENT (le delta, positif ou négatif). Toute la session est validée
// en une seule transaction.
export async function submitInventory(input: InventoryInput): Promise<ActionResult> {
  const user = await requireModuleAccess("stocks");
  const data = inventorySchema.parse(input);

  const currentStocks = await prisma.stock.findMany({
    where: {
      boutiqueId: data.boutiqueId,
      variantId: { in: data.lines.map((l) => l.variantId) },
    },
  });
  const currentByVariant = new Map(currentStocks.map((s) => [s.variantId, s.quantity]));

  const changedLines = data.lines
    .map((line) => ({
      ...line,
      delta: line.countedQuantity - (currentByVariant.get(line.variantId) ?? 0),
    }))
    .filter((line) => line.delta !== 0);

  if (changedLines.length === 0) {
    return { success: true };
  }

  await prisma.$transaction(async (tx) => {
    for (const line of changedLines) {
      await applyStockMovement(
        {
          boutiqueId: data.boutiqueId,
          variantId: line.variantId,
          type: "INVENTAIRE",
          quantity: line.delta,
          reason: "Ajustement suite à inventaire",
          userId: user.id,
        },
        tx
      );
    }
  });

  await logActivity({
    userId: user.id,
    action: "STOCK_INVENTAIRE",
    entityType: "Boutique",
    entityId: data.boutiqueId,
    details: `Inventaire réalisé : ${changedLines.length} ligne(s) ajustée(s)`,
  });

  revalidatePath("/stocks");
  revalidatePath("/dashboard");
  return { success: true };
}
