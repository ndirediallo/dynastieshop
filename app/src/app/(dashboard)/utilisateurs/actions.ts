"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
  type UserUpdateInput,
} from "@/lib/schemas";

const SALT_ROUNDS = 10;

export async function createUser(input: UserCreateInput) {
  const currentUser = await requireModuleAccess("utilisateurs");
  const data = userCreateSchema.parse(input);

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      boutiqueId: data.boutiqueId || null,
    },
  });

  await logActivity({
    userId: currentUser.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    details: `Utilisateur "${user.name}" (${user.role}) créé`,
  });

  revalidatePath("/utilisateurs");
  revalidatePath("/dashboard");
  return { id: user.id };
}

export async function updateUser(id: string, input: UserUpdateInput) {
  const currentUser = await requireModuleAccess("utilisateurs");
  const data = userUpdateSchema.parse(input);

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      boutiqueId: data.boutiqueId || null,
      ...(data.password
        ? { passwordHash: await bcrypt.hash(data.password, SALT_ROUNDS) }
        : {}),
    },
  });

  await logActivity({
    userId: currentUser.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    details: `Utilisateur "${user.name}" modifié${
      data.password ? " (mot de passe réinitialisé)" : ""
    }`,
  });

  revalidatePath("/utilisateurs");
  return { id: user.id };
}

export async function toggleUserActive(id: string, active: boolean) {
  const currentUser = await requireModuleAccess("utilisateurs");

  const user = await prisma.user.update({ where: { id }, data: { active } });

  await logActivity({
    userId: currentUser.id,
    action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "User",
    entityId: user.id,
    details: `Utilisateur "${user.name}" ${active ? "activé" : "désactivé"}`,
  });

  revalidatePath("/utilisateurs");
  revalidatePath("/dashboard");
  return { id: user.id };
}
