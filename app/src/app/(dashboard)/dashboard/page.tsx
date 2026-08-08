import { Store, Users, ShoppingCart, TriangleAlert } from "lucide-react";
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

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function DashboardPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [session, boutiques, userCount, settings, monthSales, lowStocks] =
    await Promise.all([
      auth(),
      prisma.boutique.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { users: true } } },
      }),
      prisma.user.count({ where: { active: true } }),
      getSettings(),
      prisma.sale.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { totalAmount: true },
      }),
      prisma.stock.findMany({
        include: {
          boutique: { select: { name: true } },
          variant: { include: { product: { select: { name: true } } } },
        },
      }),
    ]);

  const activeBoutiques = boutiques.filter((b) => b.active).length;
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const caMonth = monthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const alerts = lowStocks
    .filter((s) => s.quantity <= s.variant.alertThreshold)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble de l&apos;activité DYNASTIE SHOP.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Chiffre d'affaires (mois)"
          value={`${caMonth.toLocaleString()} ${settings.currency}`}
          hint="Depuis le 1er du mois"
          icon={ShoppingCart}
          tint="pink"
        />
        <KpiCard
          title="Nombre de ventes"
          value={String(monthSales.length)}
          hint="Depuis le 1er du mois"
          icon={ShoppingCart}
          tint="green"
        />
        <KpiCard
          title="Boutiques actives"
          value={String(activeBoutiques)}
          hint={`${boutiques.length} boutique(s) au total`}
          icon={Store}
          tint="blue"
        />
        <KpiCard
          title="Utilisateurs actifs"
          value={String(userCount)}
          hint="Comptes actifs"
          icon={Users}
          tint="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Résumé par boutique</CardTitle>
          </CardHeader>
          <CardContent>
            {boutiques.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune boutique enregistrée pour le moment.
              </p>
            ) : (
              <ul className="divide-y">
                {boutiques.map((boutique) => (
                  <li
                    key={boutique.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{boutique.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {boutique._count.users} utilisateur(s)
                      </p>
                    </div>
                    <Badge variant={boutique.active ? "success" : "secondary"}>
                      {boutique.active ? "Active" : "Désactivée"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-muted-foreground" />
              Alertes de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune alerte de stock pour le moment.
              </p>
            ) : (
              <ul className="divide-y">
                {alerts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {variantLabel(s.variant.product, s.variant)}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.boutique.name}</p>
                    </div>
                    <Badge variant={s.quantity <= 0 ? "destructive" : "secondary"}>
                      {s.quantity <= 0 ? "Rupture" : `${s.quantity} restant(s)`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const KPI_TINTS = {
  pink: "bg-primary/10 text-primary",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
} as const;

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tint,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: keyof typeof KPI_TINTS;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-1.5 text-2xl font-semibold">{value}</div>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${KPI_TINTS[tint]}`}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
