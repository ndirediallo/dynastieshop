import type { Prisma } from "@prisma/client";

// Centralise le filtre (mot-clé + plage de dates) utilisé à la fois par la
// page de profil et par l'export PDF — un seul endroit où ce calcul peut
// diverger, même principe que rapports/report-data.ts.
export function buildActivityWhere(
  userId: string,
  q?: string,
  from?: string,
  to?: string
): Prisma.ActivityLogWhereInput {
  return {
    userId,
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { details: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };
}

export function activityPeriodLabel(from?: string, to?: string): string {
  if (!from && !to) return "Toute la période";
  const fmt = (s: string) => new Intl.DateTimeFormat("fr-FR").format(new Date(`${s}T00:00:00`));
  if (from && to) return `Du ${fmt(from)} au ${fmt(to)}`;
  if (from) return `Depuis le ${fmt(from)}`;
  return `Jusqu'au ${fmt(to!)}`;
}
