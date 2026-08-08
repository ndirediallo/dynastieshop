import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Connexion",
  BOUTIQUE_CREATED: "Boutique créée",
  BOUTIQUE_UPDATED: "Boutique modifiée",
  BOUTIQUE_ACTIVATED: "Boutique activée",
  BOUTIQUE_DEACTIVATED: "Boutique désactivée",
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_ACTIVATED: "Utilisateur activé",
  USER_DEACTIVATED: "Utilisateur désactivé",
  SETTINGS_UPDATED: "Paramètres modifiés",
  SETTINGS_LOGO_UPDATED: "Logo mis à jour",
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const logs = await prisma.activityLog.findMany({
    where: q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { details: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Journal d&apos;activité
        </h1>
        <p className="text-sm text-muted-foreground">
          Traçabilité des actions effectuées dans l&apos;application (200
          dernières entrées).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <form className="flex gap-2" method="get">
              <Input
                name="q"
                placeholder="Rechercher par action, utilisateur ou détail..."
                defaultValue={q}
                className="max-w-sm"
              />
              <Button type="submit" variant="secondary">
                Filtrer
              </Button>
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucune activité enregistrée pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      }).format(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user?.name ?? "Système"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
