import Link from "next/link";
import {
  Plus,
  ArrowLeftRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  PackagePlus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { cn } from "@/lib/utils";
import type { Prisma, TransferStatus } from "@prisma/client";
import { RestockRequestActions } from "./restock-request-actions";

function variantLabel(variant: { color: string | null; size: string | null }) {
  return [variant.color, variant.size].filter(Boolean).join(" / ") || "Référence unique";
}

const PERIOD_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
] as const;
type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function getFromDate(period: PeriodValue): Date | undefined {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:
      return undefined;
  }
}

const STATUS_LABELS: Record<TransferStatus, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  ANNULE: "Annulé",
};

const STATUS_STYLES: Record<
  TransferStatus,
  { border: string; badgeBg: string; badgeFg: string }
> = {
  EN_ATTENTE: {
    border: "border-l-amber-500",
    badgeBg: "bg-amber-500/10",
    badgeFg: "text-amber-600 dark:text-amber-400",
  },
  VALIDE: {
    border: "border-l-emerald-500",
    badgeBg: "bg-emerald-500/10",
    badgeFg: "text-emerald-600 dark:text-emerald-400",
  },
  ANNULE: {
    border: "border-l-destructive",
    badgeBg: "bg-destructive/10",
    badgeFg: "text-destructive",
  },
};

const STATUS_ORDER: TransferStatus[] = ["EN_ATTENTE", "VALIDE", "ANNULE"];

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
  return qs ? `/transferts?${qs}` : "/transferts";
}

export default async function TransfertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("transferts");
  // Un Caissier n'a "transferts" que via un accès supplémentaire accordé
  // par le Super Admin (jamais par son rôle seul, voir lib/permissions.ts)
  // — il ne doit voir QUE les transferts de SA boutique, ni les demandes
  // de réapprovisionnement des autres (réservées à Logistique/Super Admin,
  // qui décident pour tout l'entrepôt). Logistique/Super Admin gardent la
  // vue complète, inchangée.
  const isBoutiqueScoped = user.role === "CAISSIER";
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = one(sp.status);
  const from = one(sp.from);
  const to = one(sp.to);
  const periodRaw = one(sp.period);
  const period: PeriodValue = PERIOD_OPTIONS.some((p) => p.value === periodRaw)
    ? (periodRaw as PeriodValue)
    : "all";
  const hasCustomRange = !!from || !!to;

  const createdAt: Prisma.StockTransferWhereInput["createdAt"] = hasCustomRange
    ? {
        ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
      }
    : (() => {
        const gte = getFromDate(period);
        return gte ? { gte } : undefined;
      })();

  const pendingRestockRequests = isBoutiqueScoped
    ? []
    : await prisma.restockRequest.findMany({
        where: { status: "EN_ATTENTE" },
        orderBy: { createdAt: "desc" },
        include: {
          boutique: { select: { name: true } },
          variant: { include: { product: { select: { name: true } } } },
          requestedBy: { select: { name: true } },
        },
      });

  // Affiché à côté de chaque demande pour que Logistique/Super Admin
  // sachent tout de suite si l'entrepôt peut couvrir la quantité demandée,
  // sans avoir à ouvrir "Ravitailler" pour le découvrir.
  const entrepotStockByVariant = new Map<string, number>();
  if (pendingRestockRequests.length > 0) {
    const entrepot = await prisma.boutique.findFirst({ where: { type: "ENTREPOT" } });
    if (entrepot) {
      const entrepotStocks = await prisma.stock.findMany({
        where: {
          boutiqueId: entrepot.id,
          variantId: { in: pendingRestockRequests.map((r) => r.variantId) },
        },
        select: { variantId: true, quantity: true },
      });
      for (const s of entrepotStocks) entrepotStockByVariant.set(s.variantId, s.quantity);
    }
  }

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      ...(createdAt ? { createdAt } : {}),
      ...(isBoutiqueScoped
        ? { OR: [{ fromBoutiqueId: user.boutiqueId ?? "" }, { toBoutiqueId: user.boutiqueId ?? "" }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      fromBoutique: { select: { name: true } },
      toBoutique: { select: { name: true } },
      items: true,
    },
  });

  const statusCounts = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = transfers.filter((t) => t.status === s).length;
      return acc;
    },
    {} as Record<TransferStatus, number>
  );

  const filteredTransfers = status
    ? transfers.filter((t) => t.status === status)
    : transfers;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ArrowLeftRight}
        title="Transferts"
        description={
          isBoutiqueScoped
            ? "Les transferts de votre boutique avec l'entrepôt central"
            : "Entre l'entrepôt central et les boutiques"
        }
        tint="purple"
        actions={
          <Button nativeButton={false} render={<Link href="/transferts/nouveau" />}>
            <Plus className="mr-2 size-4" />
            Nouveau transfert
          </Button>
        }
      />

      {pendingRestockRequests.length > 0 && (
        <Card className="border-amber-500/20">
          <SectionHeader
            icon={PackagePlus}
            title={`Demandes de réapprovisionnement (${pendingRestockRequests.length})`}
            description="Signalées par les boutiques, à transformer en transfert si justifié"
            tint="amber"
          />
          <CardContent>
            <div className="flex flex-col gap-2">
              {pendingRestockRequests.map((r) => {
                const available = entrepotStockByVariant.get(r.variantId) ?? 0;
                const insufficient = !!r.quantity && available < r.quantity;
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {variantLabel(r.variant)} · {r.variant.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.boutique.name} · {r.requestedBy?.name ?? "—"}
                        {r.quantity ? ` · ${r.quantity} demandé${r.quantity > 1 ? "s" : ""}` : ""}
                        {r.note ? ` · « ${r.note} »` : ""}
                      </p>
                      <p
                        className={cn(
                          "font-figures text-xs tabular-nums",
                          insufficient ? "font-semibold text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {available} disponible{available > 1 ? "s" : ""} à l&apos;entrepôt
                      </p>
                    </div>
                    <RestockRequestActions id={r.id} defaultQuantity={r.quantity} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Transferts</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {transfers.length}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 shadow-sm dark:text-purple-400">
              <ArrowLeftRight className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {statusCounts.EN_ATTENTE}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">À confirmer ou annuler</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm dark:text-amber-400">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Validés</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {statusCounts.VALIDE}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-sm dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Annulés</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {statusCounts.ANNULE}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive shadow-sm">
              <XCircle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.value}
              variant={!hasCustomRange && period === p.value ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={
                <Link
                  href={hrefWithOverrides(sp, {
                    period: p.value,
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
          action="/transferts"
          method="get"
          className="flex flex-wrap items-end gap-1.5"
        >
          {status && <input type="hidden" name="status" value={status} />}
          <div className="space-y-1">
            <Label htmlFor="from" className="text-[0.7rem] text-muted-foreground">
              Du
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
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
              defaultValue={to ?? ""}
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
              render={<Link href={hrefWithOverrides(sp, { from: undefined, to: undefined })} />}
            >
              Effacer
            </Button>
          )}
        </form>
      </div>

      <div className="flex w-fit flex-wrap gap-2 rounded-full border p-1">
        <Button
          variant={!status ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href={hrefWithOverrides(sp, { status: undefined })} />}
        >
          Tous <span className="ml-1 opacity-70">{transfers.length}</span>
        </Button>
        {STATUS_ORDER.map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            nativeButton={false}
            render={<Link href={hrefWithOverrides(sp, { status: s })} />}
          >
            {STATUS_LABELS[s]} <span className="ml-1 opacity-70">{statusCounts[s]}</span>
          </Button>
        ))}
      </div>

      {filteredTransfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <ArrowLeftRight className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun transfert ne correspond à ces filtres.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTransfers.map((t) => {
            const style = STATUS_STYLES[t.status];
            const totalQty = t.items.reduce((s, i) => s + i.quantity, 0);

            return (
              <Link
                key={t.id}
                href={`/transferts/${t.id}`}
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-xl border border-l-[3px] bg-card p-4 transition-shadow hover:shadow-sm sm:flex-nowrap",
                  style.border,
                  t.status === "ANNULE" && "opacity-60"
                )}
              >
                <div className="w-full shrink-0 sm:w-36">
                  <p className="font-semibold">{t.reference}</p>
                  <p className="font-figures text-xs tabular-nums text-muted-foreground">
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                      t.createdAt
                    )}
                  </p>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                  <span className="truncate">{t.fromBoutique.name}</span>
                  <ArrowLeftRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.toBoutique.name}</span>
                </div>

                <div className="shrink-0 text-xs text-muted-foreground sm:w-28">
                  {t.items.length} ligne{t.items.length > 1 ? "s" : ""} ·{" "}
                  <span className="font-figures tabular-nums">{totalQty}</span> art.
                </div>

                <div className="shrink-0 sm:w-36 sm:text-right">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
                      style.badgeBg,
                      style.badgeFg
                    )}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>

                <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
