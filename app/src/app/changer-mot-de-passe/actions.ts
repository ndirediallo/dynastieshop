"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { ForbiddenError } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { pinOnlySchema, type PinOnlyInput } from "@/lib/schemas";

const SALT_ROUNDS = 10;

// Étape obligatoire après une création de compte ou une réinitialisation
// par le Super Admin (voir middleware.ts, qui bloque toute autre page tant
// que User.mustChangePassword est vrai). Pas d'ancien code à fournir ici —
// contrairement à changeOwnPassword (utilisateurs/actions.ts) — puisque le
// code précédent est justement celui, générique, qu'on force à remplacer.
export async function completePasswordChange(input: PinOnlyInput) {
  const session = await auth();
  if (!session?.user) throw new ForbiddenError("Non authentifié");
  const data = pinOnlySchema.parse(input);

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await logActivity({
    userId: session.user.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: session.user.id,
    details: `Mot de passe défini par ${session.user.name ?? "l'utilisateur"} après réinitialisation`,
  });
}
