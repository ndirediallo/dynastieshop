"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import {
  expenseSchema,
  fixedExpenseSchema,
  type ExpenseInput,
  type FixedExpenseInput,
} from "@/lib/schemas";

// Ouvert à quiconque a accès au module "dépenses" — par défaut Super Admin
// seul, mais un Caissier peut s'en voir accorder l'accès individuellement
// (case "Dépenses" dans son profil, voir lib/permissions.ts). Dans ce cas,
// il ne peut enregistrer une dépense que pour SA PROPRE boutique — le
// champ boutique envoyé par le formulaire est ignoré pour lui, jamais fait
// confiance côté client.
export async function createExpense(input: ExpenseInput) {
  const user = await requireModuleAccess("depenses");
  const data = expenseSchema.parse(input);

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && !user.boutiqueId) {
    throw new Error("Votre compte n'est rattaché à aucune boutique.");
  }

  const expense = await prisma.expense.create({
    data: {
      type: data.type,
      amount: data.amount,
      date: new Date(data.date),
      boutiqueId: isSuperAdmin ? data.boutiqueId || null : user.boutiqueId,
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
}

export async function createFixedExpense(input: FixedExpenseInput) {
  await requireRole("SUPER_ADMIN");
  const data = fixedExpenseSchema.parse(input);

  await prisma.fixedExpense.create({
    data: {
      label: data.label,
      amount: data.amount,
      boutiqueId: data.boutiqueId || null,
    },
  });

  revalidatePath("/depenses");
}

export async function updateFixedExpense(id: string, input: FixedExpenseInput) {
  await requireRole("SUPER_ADMIN");
  const data = fixedExpenseSchema.parse(input);

  await prisma.fixedExpense.update({
    where: { id },
    data: {
      label: data.label,
      amount: data.amount,
      boutiqueId: data.boutiqueId || null,
    },
  });

  revalidatePath("/depenses");
}

export async function toggleFixedExpenseActive(id: string, active: boolean) {
  await requireRole("SUPER_ADMIN");
  await prisma.fixedExpense.update({ where: { id }, data: { active } });
  revalidatePath("/depenses");
}

// Enregistre l'occurrence du mois pour une dépense fixe : crée une Expense
// normale liée au modèle (montant du modèle, mais reste modifiable comme
// n'importe quelle dépense après coup — un loyer qui change un mois ne
// doit pas obliger à toucher au modèle).
export async function logFixedExpense(fixedExpenseId: string, date: string) {
  const user = await requireRole("SUPER_ADMIN");

  const template = await prisma.fixedExpense.findUnique({ where: { id: fixedExpenseId } });
  if (!template) throw new Error("Dépense fixe introuvable.");

  const expense = await prisma.expense.create({
    data: {
      type: template.label,
      amount: template.amount,
      date: new Date(date),
      boutiqueId: template.boutiqueId,
      userId: user.id,
      fixedExpenseId: template.id,
    },
  });

  await logActivity({
    userId: user.id,
    action: "EXPENSE_CREATED",
    entityType: "Expense",
    entityId: expense.id,
    details: `Dépense fixe "${template.label}" de ${template.amount} enregistrée`,
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
}
