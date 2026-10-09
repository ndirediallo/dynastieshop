import Link from "next/link";
import { Plus, ClipboardList, ChevronLeft, Store, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { PaymentDialog } from "../payment-dialog";
import { PurchaseOrderDeleteButton } from "./purchase-order-delete-button";
import type { Prisma, PurchaseOrderStatus } from "@prisma/client";

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

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_TOTALE: "Reçue totalement",
  ANNULEE: "Annulée",
};

const STATUS_STYLES: Record<
  PurchaseOrderStatus,
  { border: string; bar: string; badgeBg: string; badgeFg: string }
> = {
  BROUILLON: {
    border: "border-l-slate-400",
    bar: "bg-slate-400",
    badgeBg: "bg-muted",
    badgeFg: "text-muted-foreground",
  },
  ENVOYEE: {
    border: "border-l-slate-400",
    bar: "bg-slate-400",
    badgeBg: "bg-muted",
    badgeFg: "text-muted-foreground",
  },
  RECUE_PARTIELLE: {
    border: "border-l-amber-500",
    bar: "bg-amber-500",
    badgeBg: "bg-amber-500/10",
    badgeFg: "text-amber-600 dark:text-amber-400",
  },
  RECUE_TOTALE: {
    border: "border-l-emerald-500",
    bar: "bg-emerald-500",
    badgeBg: "bg-emerald-500/10",
    badgeFg: "text-emerald-600 dark:text-emerald-400",
  },
  ANNULEE: {
    border: "border-l-destructive",
    bar: "bg-destructive",
    badgeBg: "bg-destructive/10",
    badgeFg: "text-destructive",
  },
};

const STATUS_ORDER: PurchaseOrderStatus[] = [
  "ENVOYEE",
  "RECUE_PARTIELLE",
  "RECUE_TOTALE",
  "BROUILLON",
  "ANNULEE",
];

type PaymentStatus = "none" | "partial" | "paid";

function getPaymentStatus(owed: number, paid: number): PaymentStatus {
  if (paid <= 0.01) return "none";
  if (paid >= owed - 0.01) return "paid";
  return "partial";
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  none: "Non payée",
  partial: "Partiellement payée",
  paid: "Payée",
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, { bg: string; fg: string }> = {
  none: { bg: "bg-destructive/10", fg: "text-destructive" },
  partial: { bg: "bg-amber-500/10", fg: "text-amber-600 dark:text-amber-400" },
  paid: { bg: "bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-400" },
};

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
  return qs ? `/fournisseurs/commandes?${qs}` : "/fournisseurs/commandes";
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("fournisseurs");
  const canManagePayments = user.role === "SUPER_ADMIN" || user.role === "LOGISTIQUE";
  const settings = await getSettings();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = one(sp.status);
  const supplierId = one(sp.supplierId);
  const from = one(sp.from);
  const to = one(sp.to);
  const periodRaw = one(sp.period);
  const period: PeriodValue = PERIOD_OPTIONS.some((p) => p.value === periodRaw)
    ? (periodRaw as PeriodValue)
    : "all";
  const hasCustomRange = !!from || !!to;

  const createdAt: Prisma.PurchaseOrderWhereInput["createdAt"] = hasCustomRange
    ? {
        ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
      }
    : (() => {
        const gte = getFromDate(period);
        return gte ? { gte } : undefined;
      })();

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      ...(supplierId ? { supplierId } : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      boutique: { select: { name: true } },
      items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
      payments: { select: { amount: true } },
    },
  });

  const statusCounts = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = orders.filter((o) => o.status === s).length;
      return acc;
    },
    {} as Record<PurchaseOrderStatus, number>
  );

  const filteredOrders = status
    ? orders.filter((o) => o.status === status)
    : orders;

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/fournisseurs" />}
      >
        <ChevronLeft className="mr-2 size-4" />
        Fournisseurs
      </Button>

      <PageHeader
        icon={ClipboardList}
        title="Commandes fournisseurs"
        description="Suivi des commandes et de leur réception."
        tint="slate"
        actions={
          user.role === "SUPER_ADMIN" && (
            <Button
              nativeButton={false}
              render={<Link href="/fournisseurs/commandes/nouvelle" />}
              className="bg-teal-600 text-white hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400"
            >
              <Plus className="mr-2 size-4" />
              Nouvelle commande
            </Button>
          )
        }
      />

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
          action="/fournisseurs/commandes"
          method="get"
          className="flex flex-wrap items-end gap-1.5"
        >
          {status && <input type="hidden" name="status" value={status} />}
          {supplierId && <input type="hidden" name="supplierId" value={supplierId} />}
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

      <div className="flex flex-wrap gap-2 rounded-full border p-1 w-fit">
        <Button
          variant={!status ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href={hrefWithOverrides(sp, { status: undefined })} />}
        >
          Toutes <span className="ml-1 opacity-70">{orders.length}</span>
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

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucune commande {status ? "avec ce statut" : "enregistrée pour le moment"}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredOrders.map((order) => {
            const ordered = order.items.reduce((s, i) => s + i.quantityOrdered, 0);
            const received = order.items.reduce((s, i) => s + i.quantityReceived, 0);
            const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
            const style = STATUS_STYLES[order.status];
            const isCancelled = order.status === "ANNULEE";
            // Dû = marchandise reçue non encore payée (voir SupplierPayment).
            // Une commande pas encore reçue n'a simplement rien à payer —
            // pas de badge dans ce cas, pour ne pas suggérer une dette qui
            // n'existe pas encore.
            const owed = order.items.reduce(
              (s, i) => s + Number(i.unitCost) * i.quantityReceived,
              0
            );
            const paid = order.payments.reduce((s, p) => s + Number(p.amount), 0);
            const balance = Math.round((owed - paid) * 100) / 100;
            const payStatus = owed > 0 ? getPaymentStatus(owed, paid) : null;
            const payStyle = payStatus ? PAYMENT_STATUS_STYLES[payStatus] : null;

            return (
              <div
                key={order.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-xl border border-l-[3px] bg-card p-4 transition-shadow hover:shadow-sm sm:flex-nowrap",
                  style.border,
                  isCancelled && "opacity-60"
                )}
              >
                <Link
                  href={`/fournisseurs/commandes/${order.id}`}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-4 sm:flex-nowrap"
                >
                <div className="w-full sm:w-44 shrink-0">
                  <p className="font-semibold">{order.reference}</p>
                  <p className="text-xs text-muted-foreground">{order.supplier.name}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-44">
                  <Store className="size-3.5" />
                  {order.boutique.name}
                </div>

                <div className="min-w-40 flex-1">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {received} / {ordered} article{ordered > 1 ? "s" : ""}
                    </span>
                    <span>{isCancelled ? "—" : `${pct}%`}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    {!isCancelled && (
                      <div
                        className={cn("h-full rounded-full", style.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-1 sm:w-44 sm:items-end">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
                      style.badgeBg,
                      style.badgeFg
                    )}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                  {payStatus && payStyle && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        payStyle.bg,
                        payStyle.fg
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[payStatus]}
                    </span>
                  )}
                </div>
                </Link>

                {payStatus && payStatus !== "paid" && canManagePayments ? (
                  <PaymentDialog
                    purchaseOrderId={order.id}
                    balance={balance}
                    currency={settings.currency}
                    activeMethods={settings.activePaymentMethods}
                    small
                  />
                ) : (
                  <Link href={`/fournisseurs/commandes/${order.id}`}>
                    <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                  </Link>
                )}

                {user.role === "SUPER_ADMIN" && received === 0 && (
                  <PurchaseOrderDeleteButton id={order.id} reference={order.reference} small />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
