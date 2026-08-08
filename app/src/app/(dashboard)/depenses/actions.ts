"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { expenseSchema, type ExpenseInput } from "@/lib/schemas";

// Saisie réservée au Super Admin (décision validée — voir document
// d'architecture, §5). Peut être élargie plus tard sans tout reconstruire.
export async function createExpense(input: ExpenseInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = expenseSchema.parse(input);

  const expense = await prisma.expense.create({
    data: {
      type: data.type,
      amount: data.amount,
      date: new Date(data.date),
      boutiqueId: data.boutiqueId || null,
      comment: data.comment || null,
      userId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "EXPENSE_CREATED",
    entityType: "Expense",
    entityId: expense.id,
    details: `Dépense "${data.type}" de ${data.amount} enregistrée`,
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  return expense;
}
