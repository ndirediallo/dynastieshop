"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

// Vérifie le code à 4 chiffres de l'utilisateur déjà connecté, pour l'écran
// de verrouillage automatique (voir IdleWatcher) — la session en cours
// reste valide pendant le verrouillage, ça ne fait que débloquer l'écran,
// jamais une nouvelle connexion. Réutilise le même compteur d'échecs /
// blocage temporaire que la connexion normale (voir auth.ts) : un code à 4
// chiffres reste devinable, la protection doit être la même aux deux
// endroits.
export async function verifyUnlockPin(
  pin: string
): Promise<{ ok: true } | { ok: false; lockedOut: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, lockedOut: false };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) {
    return { ok: false, lockedOut: false };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, lockedOut: true };
  }

  const isValid = await bcrypt.compare(pin, user.passwordHash);

  if (!isValid) {
    const settings = await getSettings();
    const attempts = user.failedLoginAttempts + 1;
    const lockedOut = attempts >= settings.maxFailedLoginAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: lockedOut
          ? new Date(Date.now() + settings.lockoutDurationMinutes * 60 * 1000)
          : null,
      },
    });
    return { ok: false, lockedOut };
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  return { ok: true };
}
