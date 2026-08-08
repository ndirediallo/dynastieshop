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
  if (!can(session.user.role, module)) {
    throw new ForbiddenError("Accès refusé pour ce rôle");
  }
  return session.user;
}
