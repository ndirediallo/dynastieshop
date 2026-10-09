"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireModuleAccess, ForbiddenError } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { GRANTABLE_EXTRA_MODULES, type Module } from "@/lib/permissions";
import {
  userCreateSchema,
  userUpdateSchema,
  changeOwnPasswordSchema,
  type UserCreateInput,
  type UserUpdateInput,
  type ChangeOwnPasswordInput,
} from "@/lib/schemas";

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "0000";

// Un Caissier fait des ventes, donc ne peut être rattaché qu'à une vraie
// boutique — jamais à l'entrepôt central. Le dialogue filtre déjà ses
// options, mais c'est cette vérification serveur qui compte réellement.
async function assertBoutiqueCompatibleWithRole(role: string, boutiqueId: string | null | undefined) {
  if (role !== "CAISSIER" || !boutiqueId) return;
  const boutique = await prisma.boutique.findUnique({
    where: { id: boutiqueId },
    select: { type: true },
  });
  if (!boutique || boutique.type !== "BOUTIQUE") {
    throw new Error("Un caissier ne peut être rattaché qu'à une boutique, pas à l'entrepôt.");
  }
}

// Ne fait jamais confiance au tableau envoyé par le client : même si l'UI
// ne propose que GRANTABLE_EXTRA_MODULES, un appel direct à createUser/
// updateUser ne doit pas pouvoir accorder "utilisateurs" ou "parametres" —
// ça reviendrait à créer un second Super Admin de fait.
function sanitizeExtraModules(modules: string[]): string[] {
  return modules.filter((m) => GRANTABLE_EXTRA_MODULES.includes(m as Module));
}

export async function createUser(input: UserCreateInput) {
  const currentUser = await requireModuleAccess("utilisateurs");
  const data = userCreateSchema.parse(input);
  await assertBoutiqueCompatibleWithRole(data.role, data.boutiqueId);

  // Code par défaut imposé, jamais choisi à la création (voir discussion
  // avec l'utilisateur) — l'utilisateur doit en définir un à lui dès sa
  // première connexion (voir middleware.ts + /changer-mot-de-passe).
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      phone: data.phone,
      passwordHash,
      mustChangePassword: true,
      role: data.role,
      boutiqueId: data.boutiqueId || null,
      extraModules: sanitizeExtraModules(data.extraModules),
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
  await assertBoutiqueCompatibleWithRole(data.role, data.boutiqueId);

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      role: data.role,
      boutiqueId: data.boutiqueId || null,
      extraModules: sanitizeExtraModules(data.extraModules),
      ...(data.resetPassword
        ? {
            passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS),
            mustChangePassword: true,
            // Réinitialiser un code débloque aussi un compte verrouillé
            // suite à de précédents échecs de connexion.
            failedLoginAttempts: 0,
            lockedUntil: null,
          }
        : {}),
    },
  });

  await logActivity({
    userId: currentUser.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    details: `Utilisateur "${user.name}" modifié${
      data.resetPassword ? " (mot de passe réinitialisé à sa valeur par défaut)" : ""
    }`,
  });

  revalidatePath("/utilisateurs");
  return { id: user.id };
}

// Changement de code PIN par l'utilisateur lui-même — n'importe quel rôle
// connecté, contrairement à updateUser ci-dessus (réservé à "utilisateurs",
// donc Super Admin uniquement). Exige l'ancien code pour éviter qu'un poste
// resté ouvert permette à quelqu'un d'autre de reprendre le compte.
export async function changeOwnPassword(input: ChangeOwnPasswordInput) {
  const session = await auth();
  if (!session?.user) throw new ForbiddenError("Non authentifié");
  const data = changeOwnPasswordSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new ForbiddenError("Compte introuvable");

  const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error("Mot de passe actuel incorrect");
  }

  const passwordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await logActivity({
    userId: user.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    details: `Mot de passe modifié par ${user.name} lui-même`,
  });
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
