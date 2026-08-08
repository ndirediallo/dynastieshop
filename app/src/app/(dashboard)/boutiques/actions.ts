"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { boutiqueSchema, type BoutiqueInput } from "@/lib/schemas";

export async function createBoutique(input: BoutiqueInput) {
  const user = await requireModuleAccess("boutiques");
  const data = boutiqueSchema.parse(input);

  const boutique = await prisma.boutique.create({ data });

  await logActivity({
    userId: user.id,
    action: "BOUTIQUE_CREATED",
    entityType: "Boutique",
    entityId: boutique.id,
    details: `Boutique "${boutique.name}" créée`,
  });

  revalidatePath("/boutiques");
  revalidatePath("/dashboard");
  return boutique;
}

export async function updateBoutique(id: string, input: BoutiqueInput) {
  const user = await requireModuleAccess("boutiques");
  const data = boutiqueSchema.parse(input);

  const boutique = await prisma.boutique.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    action: "BOUTIQUE_UPDATED",
    entityType: "Boutique",
    entityId: boutique.id,
    details: `Boutique "${boutique.name}" modifiée`,
  });

  revalidatePath("/boutiques");
  return boutique;
}

export async function toggleBoutiqueActive(id: string, active: boolean) {
  const user = await requireModuleAccess("boutiques");

  const boutique = await prisma.boutique.update({
    where: { id },
    data: { active },
  });

  await logActivity({
    userId: user.id,
    action: active ? "BOUTIQUE_ACTIVATED" : "BOUTIQUE_DEACTIVATED",
    entityType: "Boutique",
    entityId: boutique.id,
    details: `Boutique "${boutique.name}" ${active ? "activée" : "désactivée"}`,
  });

  revalidatePath("/boutiques");
  revalidatePath("/dashboard");
  return boutique;
}
