import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
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

const PAGE_SIZE = 20;

export default async function InventoryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    boutiqueId?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requirePageAccess("stocks");
  const { boutiqueId, from, to, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const boutiques = await prisma.boutique.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (from) createdAtFilter.gte = new Date(`${from}T00:00:00`);
  if (to) createdAtFilter.lte = new Date(`${to}T23:59:59`);

  const where = {
    ...(boutiqueId ? { boutiqueId } : {}),
    ...(from || to ? { createdAt: createdAtFilter } : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.inventorySession.findMany({
      where,
      include: {
        boutique: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.inventorySession.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQuery = [
    boutiqueId ? `boutiqueId=${boutiqueId}` : "",
    from ? `from=${from}` : "",
    to ? `to=${to}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const pageQuery = (p: number) => `/stocks/inventaire/historique?${baseQuery}${baseQuery ? "&" : ""}page=${p}`;

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/stocks/inventaire" />}
      >
        <ChevronLeft className="mr-2 size-4" />
        Inventaire
      </Button>

      <PageHeader
        icon={History}
        title="Historique des inventaires"
        description={`Toutes les sessions de comptage enregistrées (${total} session${total > 1 ? "s" : ""}).`}
        tint="amber"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <form className="flex flex-wrap items-end gap-2" method="get">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Emplacement
                </label>
                <select
                  name="boutiqueId"
                  defaultValue={boutiqueId ?? ""}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="">Toutes</option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Du</label>
                <Input type="date" name="from" defaultValue={from} className="h-8" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Au</label>
                <Input type="date" name="to" defaultValue={to} className="h-8" />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Filtrer
              </Button>
              {(boutiqueId || from || to) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/stocks/inventaire/historique" />}
                >
                  Réinitialiser
                </Button>
              )}
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Emplacement</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Produits comptés</TableHead>
                <TableHead>Écarts</TableHead>
                <TableHead className="text-right">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Aucun inventaire enregistré pour ce filtre.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-mono text-sm font-semibold">
                      {session.reference}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(session.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">{session.boutique.name}</TableCell>
                    <TableCell className="text-sm">{session.user?.name ?? "—"}</TableCell>
                    <TableCell className="font-figures tabular-nums">
                      {session.lineCount}
                    </TableCell>
                    <TableCell>
                      {session.changeCount > 0 ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        >
                          <span className="font-figures">{session.changeCount}</span> écart
                          {session.changeCount > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="success">Aucun écart</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/stocks/inventaire/historique/${session.id}`} />}
                      >
                        <ClipboardList className="mr-2 size-3.5" />
                        Voir
                      </Button>
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
                render={<Link href={pageQuery(page - 1)} />}
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
                render={<Link href={pageQuery(page + 1)} />}
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
