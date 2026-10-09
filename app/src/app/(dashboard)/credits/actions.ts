"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { formatZodError } from "@/lib/format-error";
import { creditRepaymentSchema, type CreditRepaymentInput } from "@/lib/schemas";

type ActionResult<T> = { error: string } | { success: true; data: T };

// Un remboursement est un `Payment` supplémentaire ajouté après coup à la
// vente à crédit — pas de nouvelle vente, pas de nouveau mouvement de stock
// (la marchandise est déjà sortie au moment de la vente initiale).
export async function recordCreditRepayment(
  saleId: string,
  input: CreditRepaymentInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireModuleAccess("credits");
  let data: CreditRepaymentInput;
  try {
    data = creditRepaymentSchema.parse(input);
  } catch (e) {
    return { error: formatZodError(e) };
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { payments: true },
  });
  if (!sale || !sale.isCredit) {
    return { error: "Vente à crédit introuvable." };
  }
  if (user.role !== "SUPER_ADMIN" && sale.boutiqueId !== user.boutiqueId) {
    return { error: "Cette vente à crédit n'appartient pas à votre boutique." };
  }

  const paidSoFar = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.round((Number(sale.totalAmount) - paidSoFar) * 100) / 100;
  if (balance <= 0) {
    return { error: "Cette vente à crédit est déjà entièrement remboursée." };
  }
  if (data.amount > balance + 0.01) {
    return {
      error: `Le montant dépasse le solde restant dû (${balance}).`,
    };
  }

  const payment = await prisma.payment.create({
    data: { saleId, method: data.method, amount: data.amount, userId: user.id },
  });

  await logActivity({
    userId: user.id,
    action: "CREDIT_REPAYMENT",
    entityType: "Sale",
    entityId: saleId,
    details: `Remboursement de ${data.amount} enregistré sur la vente à crédit ${sale.reference}`,
  });

  revalidatePath("/credits");
  revalidatePath(`/credits/${saleId}`);
  return { success: true, data: { id: payment.id } };
}
