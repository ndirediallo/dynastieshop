import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
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
import { PageHeader } from "@/components/page-header";
import { ACTION_LABELS } from "@/lib/activity-labels";

const PAGE_SIZE = 25;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" as const } },
          { details: { contains: q, mode: "insensitive" as const } },
          { user: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : undefined;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qQuery = q ? `q=${encodeURIComponent(q)}&` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="Journal d'activité"
        description={`Traçabilité des actions effectuées dans l'application (${total} entrée${total > 1 ? "s" : ""}).`}
        tint="slate"
      />

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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            {page <= 1 ? (
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="mr-1 size-4" />
                Précédent
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/journal?${qQuery}page=${page - 1}`} />}
              >
                <ChevronLeft className="mr-1 size-4" />
                Précédent
              </Button>
            )}
            {page >= totalPages ? (
              <Button variant="outline" size="sm" disabled>
                Suivant
                <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/journal?${qQuery}page=${page + 1}`} />}
              >
                Suivant
                <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
