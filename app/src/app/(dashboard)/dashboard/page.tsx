import Link from "next/link";
import {
  HandCoins,
  ShoppingCart,
  TriangleAlert,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  LayoutDashboard,
  ChevronRight,
  Package,
  Receipt,
  BarChart3,
  ClipboardList,
  ArrowLeftRight,
  ListChecks,
  Store,
  Undo2,
  PackagePlus,
  Wallet,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { SectionIcon } from "@/components/section-icon";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

// La tendance partage maintenant sa ligne avec "Alertes de stock" (moitié
// moins large qu'avant) — un montant complet ("20 000 000 GNF") ne tient
// plus au-dessus de chaque barre, d'où ce format compact ("20 M").
const compactAmount = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
}).format;

// Sélecteur de période pour les cartes CA/Ventes/Retours/Dépenses du
// Super Admin (voir PERIOD_OPTIONS plus bas) — "Aujourd'hui" à "Cette
// année" plus une plage personnalisée, par défaut "Ce mois" comme avant.
const DASHBOARD_PERIOD_OPTIONS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
] as const;
type DashboardPeriodValue = (typeof DASHBOARD_PERIOD_OPTIONS)[number]["value"];

function getPeriodRange(period: DashboardPeriodValue): { gte: Date; lte?: Date } {
  const now = new Date();
  switch (period) {
    case "today":
      return { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
    case "yesterday": {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end.setMilliseconds(-1);
      return { gte: y, lte: end };
    }
    case "week": {
      // Semaine calendaire (lundi → maintenant), pas "7 derniers jours"
      // glissants — distinct de la carte "Tendance" juste en dessous.
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      return { gte: monday };
    }
    case "year":
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case "month":
    default:
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
}

function periodHint(period: DashboardPeriodValue, from?: string, to?: string): string {
  if (from || to) {
    const fmt = (s: string) => new Intl.DateTimeFormat("fr-FR").format(new Date(`${s}T00:00:00`));
    if (from && to) return `Du ${fmt(from)} au ${fmt(to)}`;
    if (from) return `Depuis le ${fmt(from)}`;
    return `Jusqu'au ${fmt(to!)}`;
  }
  switch (period) {
    case "today":
      return "Aujourd'hui";
    case "yesterday":
      return "Hier";
    case "week":
      return "Depuis lundi";
    case "year":
      return "Depuis le 1er janvier";
    case "month":
    default:
      return "Depuis le 1er du mois";
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role;
  const viewerBoutiqueId = session?.user?.boutiqueId;
  const isSuperAdminViewer = role === "SUPER_ADMIN";
  const periodRaw = sp.period;
  // Une plage personnalisée (from/to) prend toujours le dessus sur les
  // pastilles — même convention que Transferts/Dépenses/Rapports.
  const hasCustomRange = isSuperAdminViewer && (!!sp.from || !!sp.to);
  const period: DashboardPeriodValue =
    isSuperAdminViewer && DASHBOARD_PERIOD_OPTIONS.some((p) => p.value === periodRaw)
      ? (periodRaw as DashboardPeriodValue)
      : "month";

  const { startOfMonth, lte: periodLte } = (() => {
    if (hasCustomRange) {
      const gte = sp.from ? new Date(`${sp.from}T00:00:00`) : new Date(0);
      const lte = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;
      return { startOfMonth: gte, lte };
    }
    const { gte, lte } = getPeriodRange(period);
    return { startOfMonth: gte, lte };
  })();
  // Période précédente de même longueur, pour la tendance % des cartes —
  // généralise ce qui ne comparait avant que deux mois calendaires.
  const periodMs = (periodLte ?? new Date()).getTime() - startOfMonth.getTime();
  const startOfPrevMonth = new Date(startOfMonth.getTime() - periodMs - 1);

  const trendStart = new Date();
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - 6);

  // Un Caissier ou un Logistique ne doit voir que le CA, la tendance, les
  // ventes récentes et les produits les plus vendus de SA boutique —
  // jamais ceux des autres.
  const isCaissierScoped =
    (role === "CAISSIER" || role === "LOGISTIQUE") && !!viewerBoutiqueId;
  const saleScope = isCaissierScoped ? { boutiqueId: viewerBoutiqueId } : {};
  const saleReturnScope = isCaissierScoped ? { sale: { boutiqueId: viewerBoutiqueId } } : {};

  const [
    boutiques,
    settings,
    monthSales,
    prevMonthSales,
    monthReturns,
    prevMonthReturns,
    lowStocks,
    creditSales,
    trendSales,
    recentSales,
    pendingOrders,
    pendingTransfers,
    pendingRestockRequests,
    pendingSaleEditRequests,
    monthExpenses,
  ] = await Promise.all([
    // L'entrepôt n'est pas une boutique : il est exclu de ce résumé (voir
    // décision produit — il a son propre dashboard dédié via le menu
    // "Entrepôt"). Les alertes de stock, elles, restent globales
    // puisqu'une rupture à l'entrepôt reste pertinente à signaler.
    prisma.boutique.findMany({
      where: { type: "BOUTIQUE" },
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    getSettings(),
    prisma.sale.findMany({
      where: {
        createdAt: { gte: startOfMonth, ...(periodLte ? { lte: periodLte } : {}) },
        ...saleScope,
      },
      select: {
        totalAmount: true,
        boutiqueId: true,
        items: {
          select: {
            quantity: true,
            variantId: true,
            variant: {
              select: {
                color: true,
                size: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: startOfPrevMonth, lt: startOfMonth }, ...saleScope },
      select: { totalAmount: true },
    }),
    // Le CA affiché doit refléter l'argent réellement conservé, pas les
    // ventes brutes : un retour réduit le CA net du mois où il est
    // enregistré (pas celui de la vente d'origine — plus simple et
    // suffisant pour cette vue d'ensemble).
    prisma.saleReturn.findMany({
      where: {
        createdAt: { gte: startOfMonth, ...(periodLte ? { lte: periodLte } : {}) },
        ...saleReturnScope,
      },
      select: { refundAmount: true, items: { select: { quantity: true } } },
    }),
    prisma.saleReturn.findMany({
      where: { createdAt: { gte: startOfPrevMonth, lt: startOfMonth }, ...saleReturnScope },
      select: { refundAmount: true },
    }),
    // Pour Super Admin/Logistique, les alertes restent globales (une
    // rupture à l'entrepôt reste pertinente à signaler) ; un Caissier, lui,
    // ne doit voir que les alertes de SA boutique.
    prisma.stock.findMany({
      where: isCaissierScoped ? { boutiqueId: viewerBoutiqueId } : undefined,
      select: {
        id: true,
        quantity: true,
        boutiqueId: true,
        boutique: { select: { name: true } },
        variant: {
          select: {
            alertThreshold: true,
            color: true,
            size: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    // Même logique que la page Crédits : le solde dû par vente (total -
    // paiements reçus), pour afficher un seul chiffre agrégé ici.
    prisma.sale.findMany({
      where: { isCredit: true, ...saleScope },
      select: { totalAmount: true, payments: { select: { amount: true } } },
    }),
    // Tendance 7 jours : agrégée à la main (pas de librairie de graphiques
    // installée — voir discussion, on reste sur des éléments visuels faits
    // main, comme les barres de progression déjà utilisées ailleurs).
    prisma.sale.findMany({
      where: { createdAt: { gte: trendStart }, ...saleScope },
      select: { totalAmount: true, createdAt: true },
    }),
    prisma.sale.findMany({
      where: saleScope,
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        boutique: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
    // Ce qui attend une action de la part de l'utilisateur — pas seulement
    // les ventes passées. Sans ça, une commande envoyée mais jamais
    // réceptionnée ne se voit nulle part sur ce tableau de bord.
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["ENVOYEE", "RECUE_PARTIELLE"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { supplier: { select: { name: true } } },
    }),
    prisma.stockTransfer.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        fromBoutique: { select: { name: true } },
        toBoutique: { select: { name: true } },
      },
    }),
    prisma.restockRequest.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        boutique: { select: { name: true } },
        variant: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.saleEditRequest.findMany({
      where: { status: "EN_ATTENTE" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { sale: { select: { reference: true } } },
    }),
    // Toutes boutiques confondues — vue d'ensemble réservée au Super Admin
    // (voir la carte KPI plus bas) : ce qu'une caissière enregistre sur SA
    // boutique (voir depenses/actions.ts) doit se voir ici automatiquement,
    // sans étape supplémentaire.
    role === "SUPER_ADMIN"
      ? prisma.expense.findMany({
          where: { date: { gte: startOfMonth, ...(periodLte ? { lte: periodLte } : {}) } },
          select: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  // "Super Administrateur" est un libellé de rôle, pas le nom d'une
  // personne — "Bonjour, Super" (juste le premier mot) rendait ça visible
  // et un peu cassé. Les autres comptes portent de vrais noms de personnes,
  // donc le nom complet se lit naturellement dans la salutation (voir
  // discussion avec l'utilisateur).
  const greetingName = isSuperAdminViewer ? "" : (session?.user?.name ?? "");
  // Rappel explicite de la boutique d'affectation — un Caissier/Logistique
  // peut très bien ne pas s'en souvenir en se connectant, même s'il n'en a
  // qu'une seule (voir discussion avec l'utilisateur).
  const viewerBoutiqueName = viewerBoutiqueId
    ? boutiques.find((b) => b.id === viewerBoutiqueId)?.name
    : undefined;
  // % par rapport au mois précédent, affiché sur les cartes CA/Ventes.
  // Sans mois précédent (0), on ne peut pas calculer de variation
  // relative : le badge de tendance est simplement masqué.
  function trendVs(current: number, previous: number) {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }
  const returnsAmountMonth = monthReturns.reduce((sum, r) => sum + Number(r.refundAmount), 0);
  const returnsAmountPrevMonth = prevMonthReturns.reduce(
    (sum, r) => sum + Number(r.refundAmount),
    0
  );
  const returnsCountMonth = monthReturns.reduce(
    (sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0),
    0
  );
  const caGrossMonth = monthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const caGrossPrevMonth = prevMonthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  // Le CA affiché est net des retours — un chiffre brut surestimerait ce qui
  // a réellement été encaissé (voir discussion : un retour doit vraiment
  // diminuer le CA, pas juste apparaître à côté sans impact).
  const caMonth = caGrossMonth - returnsAmountMonth;
  const caPrevMonth = caGrossPrevMonth - returnsAmountPrevMonth;
  const caTrend = trendVs(caMonth, caPrevMonth);
  const salesTrend = trendVs(monthSales.length, prevMonthSales.length);
  const allAlerts = lowStocks.filter((s) => s.quantity <= s.variant.alertThreshold);
  const alerts = allAlerts.slice(0, 6);
  const rupturesCount = allAlerts.filter((s) => s.quantity <= 0).length;

  const outstandingCredit = creditSales.reduce((sum, s) => {
    const paid = s.payments.reduce((p, pay) => p + Number(pay.amount), 0);
    const balance = Number(s.totalAmount) - paid;
    return balance > 0.01 ? sum + balance : sum;
  }, 0);
  const monthExpensesTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Classement des boutiques par CA du mois, pour répondre à la question
  // qu'on se pose en ouvrant ce tableau de bord : qui vend bien, qui ne
  // vend pas — pas juste "qui est active" (voir discussion avec
  // l'utilisateur).
  const caByBoutique = new Map<string, { ca: number; count: number }>();
  for (const sale of monthSales) {
    const entry = caByBoutique.get(sale.boutiqueId) ?? { ca: 0, count: 0 };
    entry.ca += Number(sale.totalAmount);
    entry.count += 1;
    caByBoutique.set(sale.boutiqueId, entry);
  }
  const boutiqueRanking = boutiques
    .map((b) => ({
      id: b.id,
      name: b.name,
      active: b.active,
      ca: caByBoutique.get(b.id)?.ca ?? 0,
      count: caByBoutique.get(b.id)?.count ?? 0,
    }))
    .sort((a, b) => b.ca - a.ca);
  const maxCa = Math.max(1, ...boutiqueRanking.map((b) => b.ca));

  // Top produits du mois, toutes boutiques confondues — même logique que
  // le tableau de bord d'une boutique individuelle (boutiques/[id]/page.tsx),
  // appliquée ici au global.
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
  const topProducts = [...productSales.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Tendance 7 jours, construite à la main (barres CSS) plutôt qu'avec une
  // librairie de graphiques — voir discussion, on garde ce dashboard léger
  // avant la démo.
  const trendDays = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(trendStart);
    day.setDate(day.getDate() + i);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const total = trendSales
      .filter((s) => s.createdAt >= day && s.createdAt < nextDay)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    return { date: day, total };
  });
  const maxTrendDay = Math.max(1, ...trendDays.map((d) => d.total));
  const maxTopProduct = Math.max(1, ...topProducts.map((p) => p.quantity));

  const PO_STATUS_LABELS: Record<string, string> = {
    ENVOYEE: "Envoyée",
    RECUE_PARTIELLE: "Reçue partiellement",
  };
  // "À traiter" ne doit remonter que ce que ce rôle a le droit d'ouvrir —
  // un Caissier n'a accès ni à Fournisseurs ni à Transferts, lui montrer
  // ces entrées mènerait à un clic qui se fait rediriger (voir discussion).
  const extraModules = session?.user?.extraModules ?? [];
  const visiblePendingOrders = role && can(role, "fournisseurs", extraModules) ? pendingOrders : [];
  const visiblePendingTransfers = role && can(role, "transferts", extraModules) ? pendingTransfers : [];
  // Même logique que les transferts : une demande de réapprovisionnement se
  // traite depuis /transferts (Logistique/Super Admin), une demande de
  // correction de vente depuis /ventes/[id] (Super Admin uniquement — voir
  // actions.ts, createReturn).
  const visiblePendingRestockRequests =
    role && can(role, "transferts", extraModules) ? pendingRestockRequests : [];
  const visiblePendingSaleEditRequests = role === "SUPER_ADMIN" ? pendingSaleEditRequests : [];
  const pendingCount =
    visiblePendingOrders.length +
    visiblePendingTransfers.length +
    visiblePendingRestockRequests.length +
    visiblePendingSaleEditRequests.length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title={`Bonjour${greetingName ? `, ${greetingName}` : ""}`}
        description={
          // Un Super Admin voit toutes les boutiques sur cette page (KPI,
          // "Résumé par boutique"...) — lui montrer le nom d'une seule, même
          // la sienne, laisserait croire à tort que la vue est limitée à
          // celle-ci (remarque de l'utilisateur). Seul un Caissier/
          // Logistique, réellement cantonné à sa boutique, a droit au
          // message personnalisé.
          isCaissierScoped && viewerBoutiqueName
            ? `${/^(boutique|entrep[ôo]t)\b/i.test(viewerBoutiqueName) ? "" : "Boutique "}${viewerBoutiqueName} : vue d'ensemble de votre activité`
            : "Vue d'ensemble de l'activité DYNASTIE SHOP"
        }
        actions={
          isSuperAdminViewer && (
            <div className="flex flex-wrap items-end gap-1.5">
              <div className="flex flex-wrap gap-1 rounded-full border p-1">
                {DASHBOARD_PERIOD_OPTIONS.map((p) => (
                  <Button
                    key={p.value}
                    variant={!hasCustomRange && period === p.value ? "default" : "ghost"}
                    size="sm"
                    className="rounded-full"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/dashboard?period=${p.value}`}
                      />
                    }
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <form action="/dashboard" method="get" className="flex flex-wrap items-end gap-1">
                <Input
                  name="from"
                  type="date"
                  defaultValue={sp.from ?? ""}
                  aria-label="Du"
                  className="h-7 w-[9rem] rounded-full text-xs"
                />
                <Input
                  name="to"
                  type="date"
                  defaultValue={sp.to ?? ""}
                  aria-label="Au"
                  className="h-7 w-[9rem] rounded-full text-xs"
                />
                <Button type="submit" variant={hasCustomRange ? "default" : "outline"} size="sm">
                  OK
                </Button>
              </form>
            </div>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Chiffre d'affaires"
          value={`${caMonth.toLocaleString()} ${settings.currency}`}
          hint={periodHint(period, sp.from, sp.to)}
          note={
            returnsAmountMonth > 0
              ? `dont -${returnsAmountMonth.toLocaleString()} ${settings.currency} retournés`
              : undefined
          }
          icon={ShoppingCart}
          tint="pink"
          trend={caTrend}
          highlight
          href="/rapports"
        />
        <KpiCard
          title="Nombre de ventes"
          value={String(monthSales.length)}
          hint={periodHint(period, sp.from, sp.to)}
          icon={ShoppingCart}
          tint="slate"
          trend={salesTrend}
          href="/ventes/historique"
        />
        <KpiCard
          title="Retours"
          value={`${returnsCountMonth} article${returnsCountMonth > 1 ? "s" : ""}`}
          hint={`${returnsAmountMonth.toLocaleString()} ${settings.currency} remboursés`}
          icon={Undo2}
          tint="red"
          href="/ventes/historique"
        />
        <KpiCard
          title="Produits en alerte"
          value={String(allAlerts.length)}
          hint={`${rupturesCount} en rupture totale`}
          icon={TriangleAlert}
          tint="amber"
          href="/stocks?alert=1"
        />
        {role === "SUPER_ADMIN" && (
          <KpiCard
            title="Dépenses"
            value={`${monthExpensesTotal.toLocaleString()} ${settings.currency}`}
            hint={`Toutes boutiques · ${periodHint(period, sp.from, sp.to).toLowerCase()}`}
            icon={Wallet}
            tint="slate"
            href="/depenses"
          />
        )}
        <KpiCard
          title="Créances en cours"
          value={`${outstandingCredit.toLocaleString()} ${settings.currency}`}
          hint="Ventes à crédit non soldées"
          icon={HandCoins}
          tint="amber"
          href="/credits"
        />
      </div>

      {pendingCount > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={ListChecks} tint="amber" />
              À traiter ({pendingCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {visiblePendingOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/fournisseurs/commandes/${order.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{order.reference}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.supplier.name} · {PO_STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {visiblePendingTransfers.map((t) => (
                <Link
                  key={t.id}
                  href={`/transferts/${t.id}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.reference}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.fromBoutique.name} → {t.toBoutique.name} · En attente
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {visiblePendingRestockRequests.map((r) => (
                <Link
                  key={r.id}
                  href="/transferts"
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <PackagePlus className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.reference}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {variantLabel(r.variant.product, r.variant)} · {r.boutique.name}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              {visiblePendingSaleEditRequests.map((req) => (
                <Link
                  key={req.id}
                  href={`/ventes/${req.saleId}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <TriangleAlert className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{req.sale.reference}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Demande de correction
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Un classement des boutiques entre elles n'a de sens que pour
          quelqu'un qui les supervise toutes — un Caissier, rattaché à une
          seule, n'a rien à y faire (voir aussi le scope des requêtes
          ci-dessus, qui limite déjà ses propres données à sa boutique).
          Pleine largeur plutôt qu'une grille à deux colonnes vide à côté
          — chaque boutique en profite pour s'étaler sur une seule ligne
          (nom, barre, CA, ventes) au lieu de s'empiler verticalement. */}
      {role === "SUPER_ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={Store} tint="slate" />
              Résumé par boutique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {boutiqueRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune boutique enregistrée pour le moment.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {boutiqueRanking.map((b, index) => {
                  const pct = Math.round((b.ca / maxCa) * 100);
                  return (
                    <Link
                      key={b.id}
                      href={`/boutiques/${b.id}`}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                          index === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{b.name}</p>
                          {!b.active && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              Désactivée
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-figures text-sm font-bold tabular-nums">
                          {b.ca.toLocaleString()} {settings.currency}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {b.count} vente{b.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={BarChart3} tint="slate" />
              Tendance (7 derniers jours)
            </CardTitle>
            <Link
              href="/rapports"
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Détails
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              {trendDays.map((d, index) => {
                const pct = Math.max(4, Math.round((d.total / maxTrendDay) * 100));
                const isToday = index === trendDays.length - 1;
                return (
                  <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                    <p className="whitespace-nowrap font-figures text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {d.total > 0 ? compactAmount(d.total) : ""}
                    </p>
                  <div className="flex h-24 w-full items-end overflow-hidden rounded-md bg-muted">
                    <div
                      className={cn(
                        "w-full rounded-md transition-all",
                        isToday ? "bg-primary" : "bg-primary/30"
                      )}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-[11px] font-medium capitalize",
                      isToday ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d.date)}
                  </p>
                </div>
              );
            })}
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={TriangleAlert} tint="amber" />
              Alertes de stock
            </CardTitle>
            {allAlerts.length > alerts.length && (
              <Link
                href="/stocks?alert=1"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Voir tout ({allAlerts.length})
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune alerte de stock pour le moment.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {alerts.map((s) => {
                  const outOfStock = s.quantity <= 0;
                  return (
                    <Link
                      key={s.id}
                      href={`/stocks?boutiqueId=${s.boutiqueId}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border border-l-[3px] p-3 transition-colors hover:bg-muted/40",
                        outOfStock ? "border-l-destructive" : "border-l-amber-500"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {variantLabel(s.variant.product, s.variant)}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.boutique.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={outOfStock ? "destructive" : "secondary"}>
                          {outOfStock ? "Rupture" : `${s.quantity} restant${s.quantity > 1 ? "s" : ""}`}
                        </Badge>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </Link>
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
              <SectionIcon icon={Receipt} tint="slate" />
              Ventes récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune vente enregistrée pour le moment.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentSales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/ventes/${sale.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {sale.customer?.name ?? "Client de passage"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.boutique.name} ·{" "}
                        {new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(sale.createdAt)}
                      </p>
                    </div>
                    <p className="shrink-0 font-figures text-sm font-bold tabular-nums">
                      {Number(sale.totalAmount).toLocaleString()} {settings.currency}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={Package} tint="slate" />
              Produits les plus vendus (mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune vente enregistrée ce mois-ci.
              </p>
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
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
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
    </div>
  );
}

// Une seule couleur par carte, choisie pour ce qu'elle VEUT DIRE, pas pour
// varier visuellement : rose = la métrique vedette (CA), ambre = demande
// une attention/suivi (alertes, créances), rouge = signal négatif
// (retours), ardoise = simple information neutre (un compte, un total
// opérationnel). Avant cette passe, "Produits en alerte" était bleu et
// "Nombre de ventes" vert sans aucune raison liée au sens — juste pour
// remplir la grille de couleurs différentes (voir discussion design).
const KPI_TINTS = {
  pink: "bg-primary text-primary-foreground",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-destructive/10 text-destructive",
} as const;

// Fond plein (pas juste la pastille d'icône) pour la carte la plus
// importante du lot — reprend l'idée des cartes différemment teintées
// vues dans les captures de référence, plutôt qu'une grille uniforme.
const KPI_HIGHLIGHT_BG = {
  pink: "border-primary/20 bg-primary/5",
  slate: "border-slate-500/20 bg-slate-500/5",
  amber: "border-amber-500/20 bg-amber-500/5",
  red: "border-destructive/20 bg-destructive/5",
} as const;

function KpiCard({
  title,
  value,
  hint,
  note,
  icon: Icon,
  tint,
  trend,
  highlight,
  href,
}: {
  title: string;
  value: string;
  hint: string;
  // Deuxième ligne, visible même quand une tendance est affichée — sert à
  // expliquer un écart plutôt qu'à le cacher (ex. "dont -X GNF retournés"
  // sous le CA net, pour que la baisse du chiffre reste compréhensible).
  note?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: keyof typeof KPI_TINTS;
  // % vs le mois précédent — absent (null) quand il n'y a rien à comparer
  // (mois précédent à 0), pour ne pas afficher un "+100 %" trompeur.
  trend?: number | null;
  highlight?: boolean;
  // Chaque carte renvoie vers la page où ce chiffre s'explore en détail —
  // tout le reste du tableau de bord est cliquable, ces 4 cartes ne
  // faisaient pas exception avant cette passe (voir discussion).
  href: string;
}) {
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      <Card className={cn(highlight && KPI_HIGHLIGHT_BG[tint])}>
        <CardContent className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              {title}
            </p>
            <div className="mt-2 whitespace-nowrap font-figures text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
              {value}
            </div>
            {trend !== undefined && trend !== null ? (
              <p
                className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${
                  trend > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : trend < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {trend > 0 ? (
                  <ArrowUp className="size-3" />
                ) : trend < 0 ? (
                  <ArrowDown className="size-3" />
                ) : null}
                {trend > 0 ? "+" : ""}
                {trend}% vs période précédente
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
            )}
            {note && (
              <p className="font-figures mt-1 text-[11px] font-medium tabular-nums text-destructive">
                {note}
              </p>
            )}
          </div>
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${KPI_TINTS[tint]}`}
          >
            <Icon className="size-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
