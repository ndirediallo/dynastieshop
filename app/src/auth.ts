import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { getSettings } from "@/lib/settings";
import { isWithinWorkHours, resolveWorkHoursConfig } from "@/lib/work-hours";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Téléphone", type: "text" },
        password: { label: "Code", type: "password" },
      },
      authorize: async (credentials) => {
        const phone = (credentials?.phone as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!phone || !password) return null;

        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || !user.active) return null;

        // Compte temporairement bloqué suite à trop d'échecs récents.
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          // Le code de connexion ne fait que 4 chiffres (10 000 combinaisons) :
          // on bloque temporairement le compte après plusieurs échecs
          // consécutifs pour empêcher un tiers de les essayer toutes
          // rapidement depuis le formulaire. Réglable par le Super Admin
          // (Paramètres → Sécurité des comptes) plutôt que fixé dans le code.
          const settings = await getSettings();
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil:
                attempts >= settings.maxFailedLoginAttempts
                  ? new Date(Date.now() + settings.lockoutDurationMinutes * 60 * 1000)
                  : null,
            },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        // Horaires de connexion — jamais appliqué à un Super Admin (voir
        // discussion avec l'utilisateur : accès remote restreint pour
        // réduire le risque d'abus hors supervision, mais le Super Admin
        // doit toujours pouvoir intervenir). Une exception ponctuelle
        // accordée par la Super Admin (voir utilisateurs/[id]) passe outre,
        // le temps qu'elle reste valide.
        if (user.role !== "SUPER_ADMIN") {
          const now = new Date();
          const exceptionActive =
            !!user.workHoursExceptionUntil && user.workHoursExceptionUntil > now;
          if (!exceptionActive) {
            const settings = await getSettings();
            const config = resolveWorkHoursConfig({
              mode: user.workHoursMode,
              customStart: user.workHoursStart,
              customEnd: user.workHoursEnd,
              customDays: user.workHoursDays,
              globalEnabled: settings.workHoursEnabled,
              globalStart: settings.workHoursStart,
              globalEnd: settings.workHoursEnd,
              globalDays: settings.workHoursDays,
            });
            if (!isWithinWorkHours(config, now)) {
              await logActivity({
                userId: user.id,
                action: "LOGIN_BLOCKED_HOURS",
                entityType: "User",
                entityId: user.id,
                details: `Connexion refusée hors horaires autorisés pour ${user.name}`,
              });
              return null;
            }
          }
        }

        await logActivity({
          userId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
          details: `Connexion de ${user.name}`,
        });

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          boutiqueId: user.boutiqueId,
          extraModules: user.extraModules,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.phone = user.phone as string;
        token.role = user.role;
        token.boutiqueId = user.boutiqueId;
        token.extraModules = user.extraModules;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.phone = token.phone as string;
      session.user.role = token.role as Role;
      session.user.boutiqueId = token.boutiqueId as string | null;
      session.user.extraModules = (token.extraModules as string[] | undefined) ?? [];
      session.user.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false;
      return session;
    },
  },
});
