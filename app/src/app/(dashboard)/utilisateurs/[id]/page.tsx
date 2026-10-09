import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Phone, Store, UserCog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { ROLE_LABELS, MODULE_LABELS, type Module } from "@/lib/permissions";
import { ACTION_LABELS } from "@/lib/activity-labels";
import { buildActivityWhere, activityPeriodLabel } from "./activity-data";
import { DownloadActivityPdfButton } from "./download-activity-pdf-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { ToggleActiveButton } from "../toggle-active-button";

const ROLE_TINTS: Record<string, { bg: string; fg: string }> = {
  SUPER_ADMIN: { bg: "bg-primary/10", fg: "text-primary" },
  CAISSIER: { bg: "bg-blue-500/10", fg: "text-blue-600 dark:text-blue-400" },
  LOGISTIQUE: { bg: "bg-amber-500/10", fg: "text-amber-600 dark:text-amber-400" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const PAGE_SIZE = 20;

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string; from?: string; to?: string }>;
}) {
  await requirePageAccess("utilisateurs");
  const { id } = await params;
  const { page: pageRaw, q, from, to } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const hasFilters = !!q || !!from || !!to;

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { boutique: { select: { name: true } } },
    }),
    getSettings(),
  ]);
  if (!user) notFound();

  // Filtre par mot-clé (action ou détail) et par plage de dates — pour
  // retrouver vite la trace d'une action précise à une période donnée,
  // sans avoir à feuilleter les pages une par une (voir aussi /journal,
  // qui applique le même principe de recherche à l'échelle de toute
  // l'application). Partagé avec l'export PDF (activity-data.ts) pour que
  // le fichier téléchargé corresponde toujours à ce qui est filtré à
  // l'écran.
  const logsWhere = buildActivityWhere(id, q, from, to);

  const [logs, totalLogs, filteredLogsCount, salesCount, lastLog] = await Promise.all([
    prisma.activityLog.findMany({
      where: logsWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where: { userId: id } }),
    prisma.activityLog.count({ where: logsWhere }),
    prisma.sale.count({ where: { userId: id } }),
    prisma.activityLog.findFirst({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredLogsCount / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/utilisateurs/${id}?${qs}` : `/utilisateurs/${id}`;
  };
  const tint = ROLE_TINTS[user.role] ?? ROLE_TINTS.CAISSIER;
  const isLocked = user.lockedUntil && user.lockedUntil > new Date();

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/utilisateurs" />}
      >
        <ChevronLeft className="mr-2 size-4" />
        Utilisateurs
      </Button>

      <PageHeader
        icon={UserCog}
        title={user.name}
        description="Profil et historique d'activité de l'utilisateur."
        tint="slate"
      />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold",
                tint.bg,
                tint.fg
              )}
            >
              {initials(user.name)}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("font-semibold", tint.fg)}>
                  {ROLE_LABELS[user.role]}
                </Badge>
                <Badge variant={user.active ? "success" : "secondary"}>
                  {user.active ? "Actif" : "Désactivé"}
                </Badge>
                {isLocked && <Badge variant="destructive">Bloqué (échecs)</Badge>}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" />
                {user.phone}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Store className="size-3.5" />
                {user.boutique?.name ?? "Aucune boutique assignée"}
              </p>
            </div>
          </div>
          <ToggleActiveButton id={user.id} active={user.active} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Compte créé le</p>
          <p className="mt-1 text-sm font-bold">
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(user.createdAt)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Dernière activité</p>
          <p className="mt-1 text-sm font-bold">
            {lastLog
              ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
                  lastLog.createdAt
                )
              : "Aucune"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Ventes enregistrées</p>
          <p className="font-figures mt-1 text-2xl font-bold tabular-nums">{salesCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Entrées au journal</p>
          <p className="font-figures mt-1 text-2xl font-bold tabular-nums">{totalLogs}</p>
        </div>
      </div>

      {user.extraModules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accès supplémentaires accordés</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {user.extraModules.map((m) => (
              <Badge key={m} variant="secondary">
                {MODULE_LABELS[m as Module] ?? m}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Activité</CardTitle>
            <DownloadActivityPdfButton
              userId={id}
              q={q}
              from={from}
              to={to}
              periodLabel={activityPeriodLabel(from, to)}
              company={{
                name: settings.companyName,
                address: settings.address ?? null,
                phone: settings.phone ?? null,
              }}
            />
          </div>
          <form
            action={`/utilisateurs/${id}`}
            method="get"
            className="flex flex-wrap items-end gap-1.5"
          >
            <div className="space-y-1">
              <Label htmlFor="q" className="text-[0.7rem] text-muted-foreground">
                Action ou détail
              </Label>
              <Input
                id="q"
                name="q"
                placeholder="Ex : connexion, transfert..."
                defaultValue={q ?? ""}
                className="h-8 w-52 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-[0.7rem] text-muted-foreground">
                Du
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={from ?? ""}
                className="h-8 w-[9.5rem] text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-[0.7rem] text-muted-foreground">
                Au
              </Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={to ?? ""}
                className="h-8 w-[9.5rem] text-xs"
              />
            </div>
            <Button type="submit" variant={hasFilters ? "default" : "outline"} size="sm">
              Filtrer
            </Button>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={`/utilisateurs/${id}`} />}
              >
                Effacer
              </Button>
            )}
          </form>
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {filteredLogsCount} résultat{filteredLogsCount > 1 ? "s" : ""} sur {totalLogs}{" "}
              entrée{totalLogs > 1 ? "s" : ""} au total.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    {hasFilters
                      ? "Aucune activité ne correspond à ce filtre."
                      : "Aucune activité enregistrée pour cet utilisateur."}
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
                    <TableCell>
                      <Badge variant="outline">{ACTION_LABELS[log.action] ?? log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
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
                    render={<Link href={pageHref(page - 1)} />}
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
                    render={<Link href={pageHref(page + 1)} />}
                  >
                    Suivant
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
