import Link from "next/link";
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

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
];

function getFromDate(period: string | undefined) {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "month":
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requirePageAccess("rapports");
  const { period } = await searchParams;
  const activePeriod = period ?? "month";
  const from = getFromDate(activePeriod);
  const settings = await getSettings();

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isCaissier = user.role === "CAISSIER";
  const isLogistique = user.role === "LOGISTIQUE";
  const showSales = isSuperAdmin || isCaissier;
  const showStock = isSuperAdmin || isLogistique;
  const showFinance = isSuperAdmin;

  const [sales, expenses, purchaseOrders, stocks] = await Promise.all([
    showSales
      ? prisma.sale.findMany({
          where: {
            createdAt: { gte: from },
            ...(isCaissier ? { userId: user.id } : {}),
          },
          include: {
            boutique: { select: { name: true } },
            items: {
              include: { variant: { include: { product: { select: { name: true } } } } },
            },
          },
        })
      : Promise.resolve([]),
    showFinance
      ? prisma.expense.findMany({ where: { date: { gte: from } } })
      : Promise.resolve([]),
    isSuperAdmin || isLogistique
      ? prisma.purchaseOrder.findMany({
          where: { createdAt: { gte: from } },
          include: { items: true },
        })
      : Promise.resolve([]),
    showStock
      ? prisma.stock.findMany({
          include: {
            boutique: { select: { name: true } },
            variant: { include: { product: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const caTotal = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const margeEstimee = sales.reduce(
    (sum, s) =>
      sum +
      s.items.reduce(
        (itemSum, item) =>
          itemSum +
          (item.quantity * Number(item.unitPrice) -
            Number(item.discount) -
            item.quantity * Number(item.variant.purchasePrice)),
        0
      ),
    0
  );

  const ventesParBoutique = new Map<string, { name: string; total: number; count: number }>();
  for (const s of sales) {
    const entry = ventesParBoutique.get(s.boutiqueId) ?? {
      name: s.boutique.name,
      total: 0,
      count: 0,
    };
    entry.total += Number(s.totalAmount);
    entry.count += 1;
    ventesParBoutique.set(s.boutiqueId, entry);
  }

  const produitsVendus = new Map<string, { label: string; quantity: number }>();
  for (const s of sales) {
    for (const item of s.items) {
      const entry = produitsVendus.get(item.variantId) ?? {
        label: variantLabel(item.variant.product, item.variant),
        quantity: 0,
      };
      entry.quantity += item.quantity;
      produitsVendus.set(item.variantId, entry);
    }
  }
  const topProduits = [...produitsVendus.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const depensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const achatsTotal = purchaseOrders.reduce(
    (sum, po) =>
      sum +
      po.items.reduce(
        (itemSum, item) => itemSum + item.quantityReceived * Number(item.unitCost),
        0
      ),
    0
  );

  const stockValue = stocks.reduce(
    (sum, s) => sum + s.quantity * Number(s.variant.purchasePrice),
    0
  );
  const stockFaible = stocks.filter(
    (s) => s.quantity > 0 && s.quantity <= s.variant.alertThreshold
  );
  const stockRupture = stocks.filter((s) => s.quantity <= 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Vue d'ensemble de l'activité."
              : isCaissier
                ? "Vos ventes."
                : "Stocks."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={activePeriod === p.value ? "secondary" : "ghost"}
              size="sm"
              nativeButton={false} render={<Link href={`/rapports?period=${p.value}`} />}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {showSales && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Chiffre d&apos;affaires</p>
              <p className="mt-1 text-2xl font-semibold">
                {caTotal.toLocaleString()} {settings.currency}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Nombre de ventes</p>
              <p className="mt-1 text-2xl font-semibold">{sales.length}</p>
            </CardContent>
          </Card>
          {isSuperAdmin && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Marge estimée</p>
                <p className="mt-1 text-2xl font-semibold">
                  {margeEstimee.toLocaleString()} {settings.currency}
                </p>
              </CardContent>
            </Card>
          )}
          {showFinance && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Dépenses</p>
                <p className="mt-1 text-2xl font-semibold">
                  {depensesTotal.toLocaleString()} {settings.currency}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {showSales && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventes par boutique</CardTitle>
          </CardHeader>
          <CardContent>
            {ventesParBoutique.size === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur cette période.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Ventes</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...ventesParBoutique.values()].map((v) => (
                    <TableRow key={v.name}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{v.count}</TableCell>
                      <TableCell>
                        {v.total.toLocaleString()} {settings.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {showSales && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produits les plus vendus</CardTitle>
          </CardHeader>
          <CardContent>
            {topProduits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur cette période.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Quantité vendue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProduits.map((p) => (
                    <TableRow key={p.label}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {showStock && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valeur du stock (au coût)</p>
              <p className="mt-1 text-2xl font-semibold">
                {stockValue.toLocaleString()} {settings.currency}
              </p>
            </CardContent>
          </Card>
          {isSuperAdmin || isLogistique ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Achats reçus (période)</p>
                <p className="mt-1 text-2xl font-semibold">
                  {achatsTotal.toLocaleString()} {settings.currency}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {showStock && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Stock faible ({stockFaible.length}) et ruptures ({stockRupture.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockFaible.length + stockRupture.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune alerte de stock pour le moment.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...stockRupture, ...stockFaible].map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {variantLabel(s.variant.product, s.variant)}
                      </TableCell>
                      <TableCell>{s.boutique.name}</TableCell>
                      <TableCell>{s.quantity}</TableCell>
                      <TableCell>
                        {s.quantity <= 0 ? (
                          <Badge variant="destructive">Rupture</Badge>
                        ) : (
                          <Badge variant="secondary">Stock faible</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Export PDF / Excel : pas encore disponible dans cette phase.
      </p>
    </div>
  );
}
