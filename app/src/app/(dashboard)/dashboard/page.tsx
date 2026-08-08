import { Store, Users, ShoppingCart, TriangleAlert } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const [session, boutiques, userCount] = await Promise.all([
    auth(),
    prisma.boutique.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.user.count({ where: { active: true } }),
  ]);

  const activeBoutiques = boutiques.filter((b) => b.active).length;
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

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
          value="—"
          hint="Disponible avec le module Ventes"
          icon={ShoppingCart}
          tint="pink"
        />
        <KpiCard
          title="Nombre de ventes"
          value="—"
          hint="Disponible avec le module Ventes"
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
            <p className="text-sm text-muted-foreground">
              Les alertes de rupture et de stock minimum apparaîtront ici une
              fois le module Produits &amp; Stocks en place.
            </p>
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
