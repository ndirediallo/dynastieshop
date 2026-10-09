import Link from "next/link";
import { Suspense } from "react";
import {
  History,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Search,
  Eye,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { cn } from "@/lib/utils";
import {
  PERIOD_OPTIONS,
  STATUS_OPTIONS,
  PAGE_SIZE,
  parseFilters,
  getFilteredSaleRows,
  statusLabel,
  formatSaleDateTime,
} from "./filters";
import { HistorySelectFilters } from "./history-select-filters";
import { DownloadHistoryPdfButton } from "./download-history-pdf-button";

function hrefWithOverrides(
  sp: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key in overrides) continue;
    if (typeof value === "string") params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/ventes/historique?${qs}` : "/ventes/historique";
}

export default async function HistoriqueVentesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("ventes");
  const settings = await getSettings();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  const [allRows, boutiques, cashiers] = await Promise.all([
    getFilteredSaleRows(filters, user),
    isSuperAdmin
      ? prisma.boutique.findMany({
          where: { type: "BOUTIQUE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    isSuperAdmin
      ? prisma.user.findMany({
          where: { sales: { some: {} } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const caTotal = allRows.reduce((sum, r) => sum + r.totalAmount, 0);
  const returnedTotal = allRows.reduce((sum, r) => sum + r.returnedAmount, 0);
  const creditRows = allRows.filter((r) => r.isCredit && r.balance > 0.01);
  const creditDueTotal = creditRows.reduce((sum, r) => sum + r.balance, 0);

  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const pageRows = allRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const exportHref = hrefWithOverrides(sp, { page: undefined }).replace(
    "/ventes/historique",
    "/ventes/historique/export"
  );
  const exportQueryString = exportHref.includes("?") ? exportHref.split("?")[1] : "";

  const hasCustomRange = !!filters.from || !!filters.to;
  const periodLabel = hasCustomRange
    ? `Du ${filters.from ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${filters.from}T00:00:00`)) : "…"} au ${filters.to ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${filters.to}T00:00:00`)) : "…"}`
    : (PERIOD_OPTIONS.find((p) => p.value === filters.period)?.label ?? "Tout");
  const statusLabelText = STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ?? "Toutes";
  const selectedBoutiqueName = boutiques.find((b) => b.id === filters.boutiqueId)?.name;
  const selectedCashierName = cashiers.find((c) => c.id === filters.userId)?.name;
  const filterSummary = [
    periodLabel,
    statusLabelText !== "Toutes" ? statusLabelText : null,
    selectedBoutiqueName,
    selectedCashierName,
    filters.search ? `« ${filters.search} »` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function sortHref(column: "date" | "total") {
    const nextDir: "asc" | "desc" =
      filters.sortBy === column && filters.sortDir === "desc" ? "asc" : "desc";
    return hrefWithOverrides(sp, { sortBy: column, sortDir: nextDir, page: undefined });
  }

  // Champs cachés communs aux deux formulaires GET de la barre de filtres
  // (recherche et plage de dates) — chacun doit préserver les filtres
  // actifs de l'autre en les soumettant comme champs cachés, sinon valider
  // l'un effacerait silencieusement l'autre.
  function preservedFilterInputs(exclude: string[]) {
    const fields: { name: string; value: string }[] = [
      ...(!hasCustomRange && filters.period !== "all"
        ? [{ name: "period", value: filters.period as string }]
        : []),
      ...(filters.status !== "all" ? [{ name: "status", value: filters.status as string }] : []),
      ...(filters.boutiqueId ? [{ name: "boutiqueId", value: filters.boutiqueId }] : []),
      ...(filters.userId ? [{ name: "userId", value: filters.userId }] : []),
      ...(filters.sortBy !== "date" ? [{ name: "sortBy", value: filters.sortBy as string }] : []),
      ...(filters.sortDir !== "desc"
        ? [{ name: "sortDir", value: filters.sortDir as string }]
        : []),
      ...(filters.from ? [{ name: "from", value: filters.from }] : []),
      ...(filters.to ? [{ name: "to", value: filters.to }] : []),
      ...(filters.search ? [{ name: "search", value: filters.search }] : []),
    ];
    return fields
      .filter((f) => !exclude.includes(f.name))
      .map((f) => <input key={f.name} type="hidden" name={f.name} value={f.value} />);
  }

  function sortIcon(column: "date" | "total") {
    if (filters.sortBy !== column) return null;
    return filters.sortDir === "asc" ? (
      <ChevronUp className="size-3.5" />
    ) : (
      <ChevronDown className="size-3.5" />
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/ventes" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        Retour
      </Button>

      <PageHeader
        icon={History}
        title="Historique des ventes"
        description={
          isSuperAdmin
            ? "Toutes les ventes. Rien n'est jamais supprimé de cet historique"
            : "Ventes de votre boutique"
        }
        tint="green"
        actions={
          <>
            <DownloadHistoryPdfButton
              queryString={exportQueryString}
              filterSummary={filterSummary}
              currency={settings.currency}
              company={{
                name: settings.companyName,
                address: settings.address,
                phone: settings.phone,
              }}
            />
            <Button
              nativeButton={false}
              render={<Link href={exportHref} />}
              className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <Download className="mr-2 size-4" />
              Exporter (CSV)
            </Button>
          </>
        }
      />

      <div className="space-y-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <form
              action="/ventes/historique"
              method="get"
              className="flex flex-wrap items-end gap-1.5"
            >
              {preservedFilterInputs(["search"])}
              <div className="space-y-1">
                <Label htmlFor="search" className="text-xs font-medium text-primary">
                  Rechercher une vente
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    name="search"
                    type="search"
                    placeholder="Référence, nom ou téléphone du client..."
                    defaultValue={filters.search ?? ""}
                    className="h-9 w-80 pl-8"
                  />
                </div>
              </div>
              <Button type="submit" variant={filters.search ? "default" : "outline"}>
                Rechercher
              </Button>
              {filters.search && (
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={
                    <Link href={hrefWithOverrides(sp, { search: undefined, page: undefined })} />
                  }
                >
                  Effacer
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
            {PERIOD_OPTIONS.map((p) => (
              <Button
                key={p.value}
                variant={!hasCustomRange && filters.period === p.value ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                nativeButton={false}
                render={
                  <Link
                    href={hrefWithOverrides(sp, {
                      period: p.value,
                      page: undefined,
                      from: undefined,
                      to: undefined,
                    })}
                  />
                }
              >
                {p.label}
              </Button>
            ))}
          </div>

          <form
            action="/ventes/historique"
            method="get"
            className="flex flex-wrap items-end gap-1.5"
          >
            {preservedFilterInputs(["from", "to"])}
            <div className="space-y-1">
              <Label htmlFor="from" className="text-[0.7rem] text-muted-foreground">
                Du
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={filters.from ?? ""}
                className="h-7 w-[9.5rem] text-xs"
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
                defaultValue={filters.to ?? ""}
                className="h-7 w-[9.5rem] text-xs"
              />
            </div>
            <Button type="submit" variant={hasCustomRange ? "default" : "outline"} size="sm">
              Appliquer
            </Button>
            {hasCustomRange && (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={hrefWithOverrides(sp, { from: undefined, to: undefined, page: undefined })}
                  />
                }
              >
                Effacer
              </Button>
            )}
          </form>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s.value}
              variant={filters.status === s.value ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={
                <Link href={hrefWithOverrides(sp, { status: s.value, page: undefined })} />
              }
            >
              {s.label}
            </Button>
          ))}
        </div>

        {isSuperAdmin && (
          <Suspense fallback={null}>
            <HistorySelectFilters boutiques={boutiques} cashiers={cashiers} />
          </Suspense>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ventes</p>
            <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
              {allRows.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Chiffre d&apos;affaires</p>
            <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-primary">
              {caTotal.toLocaleString()} {settings.currency}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Retourné</p>
            <p
              className={cn(
                "font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight",
                returnedTotal > 0 && "text-destructive"
              )}
            >
              {returnedTotal.toLocaleString()} {settings.currency}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Crédit en cours</p>
            <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
              {creditDueTotal.toLocaleString()} {settings.currency}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {creditRows.length} vente{creditRows.length > 1 ? "s" : ""} non soldée
              {creditRows.length > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {allRows.length} vente{allRows.length > 1 ? "s" : ""}
            {totalPages > 1 && (
              <span className="ml-2 font-normal text-muted-foreground">
                · page {currentPage}/{totalPages}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold text-foreground">Référence</TableHead>
                <TableHead className="font-bold text-foreground">
                  <Link
                    href={sortHref("date")}
                    className="inline-flex items-center gap-0.5 hover:text-primary"
                  >
                    Date
                    {sortIcon("date")}
                  </Link>
                </TableHead>
                <TableHead className="font-bold text-foreground">Boutique</TableHead>
                <TableHead className="font-bold text-foreground">Client</TableHead>
                <TableHead className="font-bold text-foreground">Caissier</TableHead>
                <TableHead className="font-bold text-foreground">
                  <Link
                    href={sortHref("total")}
                    className="inline-flex items-center gap-0.5 hover:text-primary"
                  >
                    Total
                    {sortIcon("total")}
                  </Link>
                </TableHead>
                <TableHead className="font-bold text-foreground">Statut</TableHead>
                <TableHead className="font-bold text-foreground">Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucune vente ne correspond à ces filtres.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const label = statusLabel(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/ventes/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatSaleDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell>{row.boutiqueName}</TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>{row.caissierName}</TableCell>
                      <TableCell className="font-figures tabular-nums">
                        {row.totalAmount.toLocaleString()} {settings.currency}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            label === "Retour(s)"
                              ? "secondary"
                              : label === "Crédit en cours"
                                ? "destructive"
                                : label === "Crédit soldé"
                                  ? "secondary"
                                  : "success"
                          }
                        >
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ReceiptDialog
                          url={`/recus/vente/${row.id}`}
                          fileNameBase={`ticket-${row.reference}`}
                          triggerRender={
                            <Button variant="ghost" size="icon-sm" title="Voir le reçu" />
                          }
                        >
                          <Eye className="size-3.5" />
                        </ReceiptDialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              {currentPage <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="mr-1 size-4" />
                  Précédent
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={hrefWithOverrides(sp, { page: String(currentPage - 1) })} />
                  }
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Précédent
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                Page {currentPage} / {totalPages}
              </span>
              {currentPage >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Suivant
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={hrefWithOverrides(sp, { page: String(currentPage + 1) })} />
                  }
                >
                  Suivant
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
