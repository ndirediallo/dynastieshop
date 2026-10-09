import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can, type Module } from "@/lib/permissions";

export class ForbiddenError extends Error {}

// À utiliser en première ligne de chaque server action sensible : vérifie
// la session et le rôle avant toute écriture en base.
export async function requireModuleAccess(module: Module) {
  const session = await auth();
  if (!session?.user) {
    throw new ForbiddenError("Non authentifié");
  }
  if (!can(session.user.role, module, session.user.extraModules)) {
    throw new ForbiddenError("Accès refusé pour ce rôle");
  }
  return session.user;
}

// À utiliser en première ligne de chaque page de module dont l'accès n'est
// pas déjà garanti par le middleware (voir src/middleware.ts — seuls
// Boutiques/Utilisateurs/Journal/Paramètres, réservés au Super Admin, y
// sont listés). Un module accessible à un sous-ensemble de rôles (ex.
// Ventes : Super Admin + Caissier, pas Logistique) doit revérifier ici,
// sinon une URL tapée directement contournerait le menu.
export async function requirePageAccess(module: Module) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!can(session.user.role, module, session.user.extraModules)) {
    redirect("/unauthorized");
  }
  return session.user;
}

// Pour les actions plus sensibles qu'un simple accès au module (ex. créer
// un produit, alors que Caissier/Logistique n'ont accès qu'en consultation).
export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user) {
    throw new ForbiddenError("Non authentifié");
  }
  if (!roles.includes(session.user.role)) {
    throw new ForbiddenError("Accès refusé pour ce rôle");
  }
  return session.user;
}
