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
  userWorkHoursSchema,
  workHoursExceptionSchema,
  changeOwnPasswordSchema,
  type UserCreateInput,
  type UserUpdateInput,
  type UserWorkHoursInput,
  type WorkHoursExceptionInput,
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

// Horaire de connexion propre à un compte — voir src/lib/work-hours.ts.
// Jamais applicable à un Super Admin (même si l'UI ne lui montre pas ce
// contrôle, on le revérifie ici : un appel direct ne doit pas pouvoir
// restreindre un Super Admin par erreur).
export async function updateUserWorkHours(id: string, input: UserWorkHoursInput) {
  const currentUser = await requireModuleAccess("utilisateurs");
  const data = userWorkHoursSchema.parse(input);

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) throw new Error("Utilisateur introuvable");
  if (target.role === "SUPER_ADMIN") {
    throw new Error("Les horaires de connexion ne s'appliquent pas à un Super Admin");
  }

  await prisma.user.update({
    where: { id },
    data: {
      workHoursMode: data.mode,
      workHoursStart: data.mode === "CUSTOM" ? data.start : null,
      workHoursEnd: data.mode === "CUSTOM" ? data.end : null,
      workHoursDays: data.mode === "CUSTOM" ? data.days : [],
    },
  });

  await logActivity({
    userId: currentUser.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: id,
    details: `Horaires de connexion de "${target.name}" modifiés`,
  });

  revalidatePath(`/utilisateurs/${id}`);
  return { id };
}

// Dérogation ponctuelle : autorise la connexion jusqu'à une date/heure
// donnée même hors horaire normal — redevient caduque toute seule, pas de
// bascule à retirer manuellement (voir discussion avec l'utilisateur).
export async function grantWorkHoursException(id: string, input: WorkHoursExceptionInput) {
  const currentUser = await requireModuleAccess("utilisateurs");
  const data = workHoursExceptionSchema.parse(input);

  const until = new Date(data.until);
  if (Number.isNaN(until.getTime()) || until <= new Date()) {
    throw new Error("La date doit être dans le futur");
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!target) throw new Error("Utilisateur introuvable");
  if (target.role === "SUPER_ADMIN") {
    throw new Error("Les horaires de connexion ne s'appliquent pas à un Super Admin");
  }

  await prisma.user.update({ where: { id }, data: { workHoursExceptionUntil: until } });

  await logActivity({
    userId: currentUser.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: id,
    details: `Connexion exceptionnellement autorisée pour "${target.name}" jusqu'au ${until.toLocaleString("fr-FR")}`,
  });

  revalidatePath(`/utilisateurs/${id}`);
  return { id };
}

export async function revokeWorkHoursException(id: string) {
  const currentUser = await requireModuleAccess("utilisateurs");

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  if (!target) throw new Error("Utilisateur introuvable");

  await prisma.user.update({ where: { id }, data: { workHoursExceptionUntil: null } });

  await logActivity({
    userId: currentUser.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: id,
    details: `Dérogation d'horaires retirée pour "${target.name}"`,
  });

  revalidatePath(`/utilisateurs/${id}`);
  return { id };
}

// Une suppression réelle n'est autorisée que si le compte n'a strictement
// aucun historique (jamais vendu, jamais touché au stock, jamais traité de
// commande/transfert/demande...) — sinon on préserve l'intégrité de cet
// historique en refusant, et on renvoie vers la désactivation (déjà
// possible via ToggleActiveButton). Même principe que deleteProduct (voir
// produits/actions.ts). Un Super Admin ne peut jamais être supprimé par ce
// bouton, ni son propre compte — ce sont des garde-fous volontaires, pas
// une simple conséquence de l'historique.
export async function deleteUser(
  id: string
): Promise<{ error: string } | { success: true }> {
  const currentUser = await requireModuleAccess("utilisateurs");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { error: "Utilisateur introuvable." };
  }
  if (user.role === "SUPER_ADMIN") {
    return { error: "Un compte Super Admin ne peut pas être supprimé." };
  }
  if (id === currentUser.id) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const [
    saleCount,
    stockMovementCount,
    stockTransferCount,
    restockRequestCount,
    saleEditRequestCount,
    inventorySessionCount,
    purchaseOrderCount,
    supplierPaymentCount,
    saleReturnCount,
    paymentCount,
    expenseCount,
  ] = await Promise.all([
    prisma.sale.count({ where: { userId: id } }),
    prisma.stockMovement.count({ where: { userId: id } }),
    prisma.stockTransfer.count({
      where: { OR: [{ userId: id }, { validatedByUserId: id }, { cancelledByUserId: id }] },
    }),
    prisma.restockRequest.count({
      where: { OR: [{ requestedByUserId: id }, { resolvedByUserId: id }] },
    }),
    prisma.saleEditRequest.count({
      where: { OR: [{ requestedByUserId: id }, { resolvedByUserId: id }] },
    }),
    prisma.inventorySession.count({ where: { userId: id } }),
    prisma.purchaseOrder.count({
      where: { OR: [{ userId: id }, { cancelledByUserId: id }] },
    }),
    prisma.supplierPayment.count({ where: { userId: id } }),
    prisma.saleReturn.count({ where: { userId: id } }),
    prisma.payment.count({ where: { userId: id } }),
    prisma.expense.count({ where: { userId: id } }),
  ]);

  const totalHistory =
    saleCount +
    stockMovementCount +
    stockTransferCount +
    restockRequestCount +
    saleEditRequestCount +
    inventorySessionCount +
    purchaseOrderCount +
    supplierPaymentCount +
    saleReturnCount +
    paymentCount +
    expenseCount;

  if (totalHistory > 0) {
    return {
      error:
        "Ce compte a déjà de l'historique (ventes, mouvements de stock, transferts, commandes...) : désactivez-le plutôt que de le supprimer.",
    };
  }

  await prisma.user.delete({ where: { id } });

  await logActivity({
    userId: currentUser.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: id,
    details: `Utilisateur "${user.name}" supprimé (aucun historique)`,
  });

  revalidatePath("/utilisateurs");
  revalidatePath("/dashboard");
  return { success: true };
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
