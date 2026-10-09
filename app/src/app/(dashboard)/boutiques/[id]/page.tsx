import Link from "next/link";
import { notFound } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Warehouse,
  Store,
  ShoppingCart,
  Wallet,
  TriangleAlert,
  Users,
  PackagePlus,
  ArrowLeftRight,
  Boxes,
  Package,
  Receipt,
  HandCoins,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { SectionIcon } from "@/components/section-icon";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";
import { BoutiqueDialog } from "../boutique-dialog";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

// Version simple du tableau de bord par emplacement. Une boutique et
// l'entrepôt central n'ont pas le même métier — l'entrepôt ne vend rien, il
// reçoit la marchandise et l'envoie vers les boutiques — donc les deux
// affichent des indicateurs et des sections différents (voir échange avec
// l'utilisateur : "l'entrepôt ne doit pas avoir un fonctionnement de
// boutique"). La section "Crédits" viendra s'ajouter au dashboard boutique
// une fois ce module construit (voir backlog — item Ventes à crédit).
export default async function BoutiqueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const boutique = await prisma.boutique.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!boutique) notFound();

  const isEntrepot = boutique.type === "ENTREPOT";

  const [stocks, staff, expenses, settings] = await Promise.all([
    prisma.stock.findMany({
      where: { boutiqueId: id },
      include: { variant: { include: { product: { select: { name: true } } } } },
    }),
    prisma.user.findMany({ where: { boutiqueId: id }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({
      where: { boutiqueId: id, date: { gte: startOfMonth } },
      select: { amount: true },
    }),
    getSettings(),
  ]);

  const expensesMonth = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const ruptures = stocks.filter((s) => s.quantity <= 0);
  const lowStock = stocks.filter(
    (s) => s.quantity > 0 && s.quantity <= s.variant.alertThreshold
  );

  const Icon = isEntrepot ? Warehouse : Store;

  return (
    <div className="space-y-6">
      <div>
        <BackButton label="Retour" />
      </div>

      <PageHeader
        icon={Icon}
        title={boutique.name}
        description={`${isEntrepot ? "Entrepôt" : "Boutique"}${boutique.address ? ` · ${boutique.address}` : ""}`}
        tint={isEntrepot ? "blue" : "purple"}
        actions={
          <>
            <Badge variant={boutique.active ? "success" : "secondary"}>
              {boutique.active ? "Active" : "Désactivée"}
            </Badge>
            <BoutiqueDialog boutique={boutique} />
          </>
        }
      />

      {isEntrepot ? (
        <EntrepotDashboard
          id={id}
          startOfMonth={startOfMonth}
          stocks={stocks}
          ruptures={ruptures}
          lowStock={lowStock}
          staff={staff}
          expensesMonth={expensesMonth}
          userCount={boutique._count.users}
          settings={settings}
        />
      ) : (
        <BoutiqueDashboard
          id={id}
          startOfMonth={startOfMonth}
          stocks={stocks}
          ruptures={ruptures}
          lowStock={lowStock}
          staff={staff}
          expensesMonth={expensesMonth}
          userCount={boutique._count.users}
          settings={settings}
        />
      )}
    </div>
  );
}

interface StockRow {
  id: string;
  quantity: number;
  variant: {
    alertThreshold: number;
    color: string | null;
    size: string | null;
    product: { name: string };
  };
}

interface StaffRow {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}

interface SharedDashboardProps {
  id: string;
  startOfMonth: Date;
  stocks: StockRow[];
  ruptures: StockRow[];
  lowStock: StockRow[];
  staff: StaffRow[];
  expensesMonth: number;
  userCount: number;
  settings: Awaited<ReturnType<typeof getSettings>>;
}

function StockAlertsCard({
  id,
  stocks,
  ruptures,
  lowStock,
}: Pick<SharedDashboardProps, "id" | "stocks" | "ruptures" | "lowStock">) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <SectionIcon icon={TriangleAlert} tint="amber" />
          État du stock
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/stocks?boutiqueId=${id}`} />}
        >
          Voir le stock détaillé
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-bold text-destructive">
            <span className="font-figures text-lg">{ruptures.length}</span>
            en rupture
          </span>
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
            <span className="font-figures text-lg">{lowStock.length}</span>
            en stock faible
          </span>
          <span className="font-figures text-sm text-muted-foreground">
            {stocks.length} référence(s) au total
          </span>
        </div>
        {ruptures.length === 0 && lowStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte de stock pour cet emplacement.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {[...ruptures, ...lowStock].slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/stocks?boutiqueId=${id}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-l-[3px] bg-card p-3 text-sm transition-colors hover:bg-muted/40",
                  s.quantity <= 0 ? "border-l-destructive" : "border-l-amber-500"
                )}
              >
                <span className="font-semibold">{variantLabel(s.variant.product, s.variant)}</span>
                <Badge variant={s.quantity <= 0 ? "destructive" : "secondary"}>
                  {s.quantity <= 0 ? "Rupture" : `${s.quantity} restant${s.quantity > 1 ? "s" : ""}`}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StaffCard({ staff }: Pick<SharedDashboardProps, "staff">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base font-bold">
          <SectionIcon icon={Users} tint="purple" />
          Équipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun utilisateur affecté à cet emplacement.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
              >
                <span className="font-semibold">{member.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
                  {!member.active && <Badge variant="secondary">Inactif</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Dashboard d'une vraie boutique : activité de vente (CA, produits vendus,
// tickets récents).
async function BoutiqueDashboard({
  id,
  startOfMonth,
  stocks,
  ruptures,
  lowStock,
  staff,
  expensesMonth,
  settings,
}: SharedDashboardProps) {
  const startOfPrevMonth = new Date(startOfMonth);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);

  const [monthSales, prevMonthSales, creditSales, receivedTransfers] = await Promise.all([
    prisma.sale.findMany({
      where: { boutiqueId: id, createdAt: { gte: startOfMonth } },
      include: {
        user: { select: { name: true } },
        items: { include: { variant: { include: { product: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sale.findMany({
      where: { boutiqueId: id, createdAt: { gte: startOfPrevMonth, lt: startOfMonth } },
      select: { totalAmount: true },
    }),
    // Carte "Créances en cours" ci-dessous — prévue depuis la construction
    // du module Crédits, jamais ajoutée jusqu'ici (voir discussion).
    prisma.sale.findMany({
      where: { boutiqueId: id, isCredit: true },
      include: { customer: { select: { name: true } }, payments: { select: { amount: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Symétrique de "Transferts envoyés récents" côté Entrepôt — sans ça,
    // impossible de savoir ici quand la dernière livraison est arrivée
    // (voir discussion).
    prisma.stockTransfer.findMany({
      where: { toBoutiqueId: id, status: "VALIDE" },
      include: { fromBoutique: { select: { name: true } }, items: true },
      orderBy: { validatedAt: "desc" },
      take: 8,
    }),
  ]);

  // % vs le mois précédent — absent (null) quand il n'y a rien à comparer.
  function trendVs(current: number, previous: number) {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }
  const caMonth = monthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const caPrevMonth = prevMonthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const caTrend = trendVs(caMonth, caPrevMonth);
  const salesTrend = trendVs(monthSales.length, prevMonthSales.length);
  const recentSales = monthSales.slice(0, 8);

  const productSales = new Map<string, { label: string; quantity: number }>();
  for (const sale of monthSales) {
    for (const item of sale.items) {
      const existing = productSales.get(item.variantId);
      const label = variantLabel(item.variant.product, item.variant);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        productSales.set(item.variantId, { label, quantity: item.quantity });
      }
    }
  }
  const topProducts = [...productSales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const maxTopProduct = Math.max(1, ...topProducts.map((p) => p.quantity));

  const openCredits = creditSales
    .map((sale) => {
      const paid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = Math.round((Number(sale.totalAmount) - paid) * 100) / 100;
      return { sale, balance };
    })
    .filter((c) => c.balance > 0.01);
  const outstandingCredit = openCredits.reduce((sum, c) => sum + c.balance, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Chiffre d'affaires (mois)"
          value={`${caMonth.toLocaleString()} ${settings.currency}`}
          hint="Depuis le 1er du mois"
          icon={ShoppingCart}
          tint="pink"
          trend={caTrend}
        />
        <KpiCard
          title="Nombre de ventes"
          value={String(monthSales.length)}
          hint="Depuis le 1er du mois"
          icon={ShoppingCart}
          tint="green"
          trend={salesTrend}
        />
        <KpiCard
          title="Dépenses (mois)"
          value={`${expensesMonth.toLocaleString()} ${settings.currency}`}
          hint="Depuis le 1er du mois"
          icon={Wallet}
          tint="amber"
        />
        {/* Remplace l'ancienne carte "Équipe" — son nombre faisait double
            emploi avec la liste juste en dessous (voir discussion). Les
            créances, elles, n'avaient aucune place en évidence. */}
        <KpiCard
          title="Créances en cours"
          value={`${outstandingCredit.toLocaleString()} ${settings.currency}`}
          hint="Ventes à crédit non soldées"
          icon={HandCoins}
          tint="purple"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockAlertsCard id={id} stocks={stocks} ruptures={ruptures} lowStock={lowStock} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={Package} tint="green" />
              Produits les plus vendus (mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente enregistrée ce mois-ci.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topProducts.map((p, index) => {
                  const pct = Math.round((p.quantity / maxTopProduct) * 100);
                  return (
                    <div
                      key={p.label}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                          index === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.label}</p>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <p className="shrink-0 font-figures text-sm font-bold tabular-nums">
                        {p.quantity} vendu{p.quantity > 1 ? "s" : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={Receipt} tint="pink" />
              Ventes récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente enregistrée ce mois-ci.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/ventes/${sale.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{sale.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.user.name} · {sale.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="shrink-0 font-figures font-bold tabular-nums">
                      {Number(sale.totalAmount).toLocaleString()} {settings.currency}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <StaffCard staff={staff} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={HandCoins} tint="purple" />
              Créances en cours
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/credits" />}
            >
              Ouvrir Crédits
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {openCredits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune vente à crédit en cours pour cette boutique.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {openCredits.slice(0, 5).map(({ sale, balance }) => (
                  <Link
                    key={sale.id}
                    href={`/credits/${sale.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-l-[3px] border-l-amber-500 bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="font-semibold">{sale.customer?.name ?? "—"}</span>
                    <span className="shrink-0 font-figures font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {balance.toLocaleString()} {settings.currency}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={ArrowLeftRight} tint="blue" />
              Transferts reçus récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receivedTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun transfert reçu pour le moment.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {receivedTransfers.map((t) => (
                  <Link
                    key={t.id}
                    href={`/transferts/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        Depuis {t.fromBoutique.name}
                        {t.validatedAt ? ` · ${t.validatedAt.toLocaleDateString("fr-FR")}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-figures text-muted-foreground">
                      {t.items.length} article(s)
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Dashboard de l'entrepôt central : pas de ventes ici, mais l'état du
// stock global, les réceptions d'achats et les envois vers les boutiques.
async function EntrepotDashboard({
  id,
  startOfMonth,
  stocks,
  ruptures,
  lowStock,
  staff,
  expensesMonth,
  userCount,
  settings,
}: SharedDashboardProps) {
  const [receptionsMonth, recentReceptions, outgoingTransfersMonth, recentTransfers] =
    await Promise.all([
      prisma.stockMovement.findMany({
        where: { boutiqueId: id, type: "RECEPTION_ACHAT", createdAt: { gte: startOfMonth } },
        select: { quantity: true },
      }),
      prisma.stockMovement.findMany({
        where: { boutiqueId: id, type: "RECEPTION_ACHAT" },
        include: { variant: { include: { product: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.stockTransfer.count({
        where: { fromBoutiqueId: id, status: "VALIDE", validatedAt: { gte: startOfMonth } },
      }),
      prisma.stockTransfer.findMany({
        where: { fromBoutiqueId: id, status: "VALIDE" },
        include: { toBoutique: { select: { name: true } }, items: true },
        orderBy: { validatedAt: "desc" },
        take: 8,
      }),
    ]);

  const receptionsMonthQty = receptionsMonth.reduce((sum, m) => sum + m.quantity, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Références en stock"
          value={String(stocks.length)}
          hint={`${ruptures.length} en rupture`}
          icon={Boxes}
          tint="blue"
        />
        <KpiCard
          title="Réceptions (mois)"
          value={`${receptionsMonthQty.toLocaleString()} unité${receptionsMonthQty > 1 ? "s" : ""}`}
          hint="Depuis le 1er du mois"
          icon={PackagePlus}
          tint="green"
        />
        <KpiCard
          title="Transferts envoyés (mois)"
          value={String(outgoingTransfersMonth)}
          hint="Vers les boutiques"
          icon={ArrowLeftRight}
          tint="pink"
        />
        <KpiCard
          title="Équipe"
          value={String(userCount)}
          hint="Utilisateurs affectés"
          icon={Users}
          tint="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockAlertsCard id={id} stocks={stocks} ruptures={ruptures} lowStock={lowStock} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={PackagePlus} tint="green" />
              Réceptions récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentReceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune réception enregistrée.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentReceptions.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {variantLabel(m.variant.product, m.variant)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="shrink-0 font-figures font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{m.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={ArrowLeftRight} tint="purple" />
              Transferts envoyés récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun transfert envoyé pour le moment.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentTransfers.map((t) => (
                  <Link
                    key={t.id}
                    href={`/transferts/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        Vers {t.toBoutique.name}
                        {t.validatedAt ? ` · ${t.validatedAt.toLocaleDateString("fr-FR")}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-figures text-muted-foreground">
                      {t.items.length} article(s)
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <StaffCard staff={staff} />
      </div>

      {expensesMonth > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={Wallet} tint="amber" />
              Dépenses (mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-nowrap font-figures text-3xl font-bold tracking-tight tabular-nums">
              {expensesMonth.toLocaleString()} {settings.currency}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Pastilles pleines (pas juste teintées à 10%) — demande explicite :
// une palette bien visible sur toutes les cartes, pas juste les titres de
// section plus bas.
const KPI_TINTS = {
  pink: "bg-primary text-primary-foreground",
  green: "bg-emerald-500 text-white",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-violet-500 text-white",
} as const;

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tint,
  trend,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: keyof typeof KPI_TINTS;
  // % vs le mois précédent — absent (null) quand il n'y a rien à comparer.
  trend?: number | null;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{title}</p>
          <div className="mt-1.5 whitespace-nowrap font-figures text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
            {value}
          </div>
          {trend !== undefined && trend !== null ? (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                trend > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trend < 0
                    ? "text-destructive"
                    : "text-muted-foreground"
              )}
            >
              {trend > 0 ? (
                <ArrowUp className="size-3" />
              ) : trend < 0 ? (
                <ArrowDown className="size-3" />
              ) : null}
              {trend > 0 ? "+" : ""}
              {trend}% vs mois dernier
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${KPI_TINTS[tint]}`}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
