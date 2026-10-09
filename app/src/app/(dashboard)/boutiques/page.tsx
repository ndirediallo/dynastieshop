import Link from "next/link";
import { Store, Users, MapPin, Phone, ArrowRight, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { BoutiqueDialog } from "./boutique-dialog";
import { ToggleActiveButton } from "./toggle-active-button";

// L'entrepôt central n'apparaît pas dans cette grille : son tableau de bord
// est distinct de celui d'une boutique (voir discussion — l'entrepôt ne
// vend rien), accessible depuis "Stock" plutôt que depuis "Boutiques". On
// note tout de même s'il existe déjà, pour empêcher d'en créer un second
// par erreur depuis cette page.
export default async function BoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortByCreation = sort === "created";

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [allLocations, settings, monthSales, lowStocks] = await Promise.all([
    prisma.boutique.findMany({
      orderBy: sortByCreation ? { createdAt: "asc" } : { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    getSettings(),
    prisma.sale.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { totalAmount: true, boutiqueId: true },
    }),
    prisma.stock.findMany({
      select: { boutiqueId: true, quantity: true, variant: { select: { alertThreshold: true } } },
    }),
  ]);

  const rawBoutiques = allLocations.filter((b) => b.type === "BOUTIQUE");
  const entrepotExists = allLocations.some((b) => b.type === "ENTREPOT");

  // Montant d'activité affiché par boutique, mais sans classement forcé —
  // l'ordre reste alphabétique ou chronologique, au choix de l'utilisateur
  // (voir discussion : pas de numérotation 1/2/3, ce n'est pas un palmarès).
  const caByBoutique = new Map<string, { ca: number; count: number }>();
  for (const sale of monthSales) {
    const entry = caByBoutique.get(sale.boutiqueId) ?? { ca: 0, count: 0 };
    entry.ca += Number(sale.totalAmount);
    entry.count += 1;
    caByBoutique.set(sale.boutiqueId, entry);
  }
  const alertsByBoutique = new Map<string, number>();
  for (const s of lowStocks) {
    if (s.quantity <= s.variant.alertThreshold) {
      alertsByBoutique.set(s.boutiqueId, (alertsByBoutique.get(s.boutiqueId) ?? 0) + 1);
    }
  }

  const boutiques = rawBoutiques.map((b) => ({
    ...b,
    ca: caByBoutique.get(b.id)?.ca ?? 0,
    salesCount: caByBoutique.get(b.id)?.count ?? 0,
    alertCount: alertsByBoutique.get(b.id) ?? 0,
  }));
  const maxCa = Math.max(1, ...boutiques.map((b) => b.ca));

  const activeCount = boutiques.filter((b) => b.active).length;
  const totalCa = boutiques.reduce((sum, b) => sum + b.ca, 0);
  const totalAlerts = boutiques.reduce((sum, b) => sum + b.alertCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Store}
        title="Boutiques"
        description="Gérez les différentes boutiques de DYNASTIE SHOP"
        tint="purple"
        actions={<BoutiqueDialog entrepotExists={entrepotExists} />}
      />

      {boutiques.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune boutique enregistrée pour le moment.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bande de résumé : vue d'ensemble avant de descendre au détail
              de chaque boutique. */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Boutiques</p>
              <p className="mt-1 font-figures text-2xl font-bold tabular-nums">
                {boutiques.length}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Actives</p>
              <p className="mt-1 font-figures text-2xl font-bold tabular-nums">
                {activeCount} / {boutiques.length}
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">CA total (mois)</p>
              <p className="mt-1 whitespace-nowrap font-figures text-2xl font-bold tabular-nums">
                {totalCa.toLocaleString()} {settings.currency}
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-4",
                totalAlerts > 0 && "border-amber-500/20 bg-amber-500/5"
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">Produits en alerte</p>
              <p className="mt-1 font-figures text-2xl font-bold tabular-nums">{totalAlerts}</p>
            </div>
          </div>

          <div className="flex w-fit gap-2 rounded-full border p-1">
            <Button
              variant={!sortByCreation ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/boutiques" />}
            >
              Ordre alphabétique
            </Button>
            <Button
              variant={sortByCreation ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/boutiques?sort=created" />}
            >
              Date de création
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boutiques.map((boutique) => {
              const pct = Math.round((boutique.ca / maxCa) * 100);
              return (
                <Card key={boutique.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Store className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold leading-tight">{boutique.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {boutique.salesCount} vente{boutique.salesCount > 1 ? "s" : ""} ce
                            mois-ci
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={boutique.active ? "success" : "secondary"}
                        className="shrink-0"
                      >
                        {boutique.active ? "Active" : "Désactivée"}
                      </Badge>
                    </div>

                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          CA (mois)
                        </span>
                        <span className="whitespace-nowrap font-figures text-lg font-extrabold tabular-nums">
                          {boutique.ca.toLocaleString()} {settings.currency}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {boutique.alertCount > 0 && (
                      <Link
                        href={`/stocks?boutiqueId=${boutique.id}`}
                        className="flex items-center gap-2 rounded-lg border border-l-[3px] border-l-amber-500 bg-amber-500/5 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400"
                      >
                        <TriangleAlert className="size-3.5 shrink-0" />
                        {boutique.alertCount} produit{boutique.alertCount > 1 ? "s" : ""} en
                        alerte de stock
                      </Link>
                    )}

                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {boutique.address || "Adresse non renseignée"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5 shrink-0" />
                        <span>{boutique.phone || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="size-3.5 shrink-0" />
                        <span>{boutique._count.users} utilisateur(s)</span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                      <div className="flex items-center gap-1">
                        <ToggleActiveButton id={boutique.id} active={boutique.active} />
                        <BoutiqueDialog
                          boutique={{
                            id: boutique.id,
                            name: boutique.name,
                            address: boutique.address,
                            phone: boutique.phone,
                            type: boutique.type,
                          }}
                          entrepotExists={entrepotExists}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/boutiques/${boutique.id}`} />}
                      >
                        Voir l&apos;activité
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
