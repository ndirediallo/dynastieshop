import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { ACTION_LABELS } from "@/lib/activity-labels";
import { buildActivityWhere, activityPeriodLabel } from "../activity-data";

// Même filtre (mot-clé + plage de dates) que la page — voir activity-data.ts
// — mais sans pagination : le PDF couvre tout ce qui correspond, pas
// seulement la page actuellement affichée à l'écran.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requirePageAccess("utilisateurs");
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { name: true, role: true, boutique: { select: { name: true } } },
  });
  if (!user) {
    return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const logs = await prisma.activityLog.findMany({
    where: buildActivityWhere(id, q, from, to),
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    userName: user.name,
    boutiqueName: user.boutique?.name ?? null,
    periodLabel: activityPeriodLabel(from, to),
    query: q ?? null,
    logs: logs.map((l) => ({
      date: l.createdAt.toISOString(),
      action: ACTION_LABELS[l.action] ?? l.action,
      details: l.details ?? "",
    })),
  });
}
