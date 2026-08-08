import { prisma } from "@/lib/prisma";

// La configuration de l'application tient dans une unique ligne `Settings`.
// Cette fonction la récupère, ou la crée avec les valeurs par défaut si
// elle n'existe pas encore (premier démarrage sans seed).
export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return existing;
  return prisma.settings.create({ data: {} });
}
