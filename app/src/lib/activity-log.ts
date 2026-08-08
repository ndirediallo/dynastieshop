import { prisma } from "@/lib/prisma";

interface LogActivityParams {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}

// Enregistre une action sensible dans le Journal d'activité. Appelé depuis
// les server actions (connexion, CRUD boutiques/utilisateurs, etc.).
export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  details,
}: LogActivityParams) {
  await prisma.activityLog.create({
    data: {
      userId: userId ?? null,
      action,
      entityType,
      entityId,
      details,
    },
  });
}
