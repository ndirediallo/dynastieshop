import Link from "next/link";
import { BarChart3 } from "lucide-react";
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
import { PERIODS, periodLabel, variantLabel, getReportData } from "./report-data";
import { DownloadReportPdfButton } from "./download-report-pdf-button";

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requirePageAccess("rapports");
  const { period, from, to } = await searchParams;
  const activePeriod = period ?? "month";
  // Plage personnalisée (archives) : dès qu'une des deux dates est
  // renseignée, elle prend le pas sur les préréglages — même principe que
  // sur le tableau de bord.
  const hasCustomRange = !!from || !!to;
  const settings = await getSettings();

  const {
    from: rangeFrom,
    to: rangeTo,
    isSuperAdmin,
    isCaissier,
    showSales,
    showStock,
    showFinance,
    sales,
    caTotal,
    revenuLivraison,
    margeEstimee,
    ventesParBoutique,
    topProduits,
    topProduitsByMargin,
    depensesTotal,
    achatsTotal,
    stockValue,
    stockFaible,
    stockRupture,
  } = await getReportData(activePeriod, user, { from, to });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Rapports"
        description={
          isSuperAdmin
            ? "Vue d'ensemble de l'activité"
            : isCaissier
              ? "Ventes de votre boutique"
              : "Stocks"
        }
        tint="blue"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
              {PERIODS.map((p) => (
                <Button
                  key={p.value}
                  variant={!hasCustomRange && activePeriod === p.value ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  nativeButton={false} render={<Link href={`/rapports?period=${p.value}`} />}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <form action="/rapports" method="get" className="flex flex-wrap items-end gap-1.5">
              <div className="space-y-1">
                <Label htmlFor="from" className="text-[0.7rem] text-muted-foreground">
                  Du
                </Label>
                <Input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={from ?? ""}
                  className="h-7 w-[9.5rem] rounded-full text-xs"
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
                  className="h-7 w-[9.5rem] rounded-full text-xs"
                />
              </div>
              <Button type="submit" variant={hasCustomRange ? "default" : "outline"} size="sm">
                OK
              </Button>
              {hasCustomRange && (
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/rapports" />}
                >
                  Effacer
                </Button>
              )}
            </form>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={`/rapports/export?period=${activePeriod}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}
                />
              }
            >
              Exporter (Excel)
            </Button>
            <DownloadReportPdfButton
              period={activePeriod}
              from={from}
              to={to}
              currency={settings.currency}
              company={{
                name: settings.companyName,
                address: settings.address ?? null,
                phone: settings.phone ?? null,
              }}
            />
          </div>
        }
      />

      {showSales && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Chiffre d&apos;affaires</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight">
                {caTotal.toLocaleString()} {settings.currency}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Nombre de ventes</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight">{sales.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Revenus livraison</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight">
                {revenuLivraison.toLocaleString()} {settings.currency}
              </p>
            </CardContent>
          </Card>
          {isSuperAdmin && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Marge estimée</p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight">
                  {margeEstimee.toLocaleString()} {settings.currency}
                </p>
              </CardContent>
            </Card>
          )}
          {showFinance && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Dépenses</p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Ventes</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Livraison</TableHead>
                  <TableHead>Marge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventesParBoutique.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aucune vente sur cette période.
                    </TableCell>
                  </TableRow>
                ) : (
                  ventesParBoutique.map((v) => (
                    <TableRow key={v.name}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{v.count}</TableCell>
                      <TableCell>
                        {v.total.toLocaleString()} {settings.currency}
                      </TableCell>
                      <TableCell>
                        {v.delivery.toLocaleString()} {settings.currency}
                      </TableCell>
                      <TableCell
                        className={
                          v.margin < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {v.margin.toLocaleString()} {settings.currency}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showSales && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produits les plus vendus</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Quantité vendue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProduits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                      Aucune vente sur cette période.
                    </TableCell>
                  </TableRow>
                ) : (
                  topProduits.map((p) => (
                    <TableRow key={p.label}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showSales && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produits les plus rentables</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Marge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProduitsByMargin.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                      Aucune vente sur cette période.
                    </TableCell>
                  </TableRow>
                ) : (
                  topProduitsByMargin.map((p) => (
                    <TableRow key={p.label}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell
                        className={
                          p.margin < 0
                            ? "text-destructive"
                            : "text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {p.margin.toLocaleString()} {settings.currency}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showStock && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valeur du stock (au coût)</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight">
                {stockValue.toLocaleString()} {settings.currency}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Achats reçus (période)</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight">
                {achatsTotal.toLocaleString()} {settings.currency}
              </p>
            </CardContent>
          </Card>
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
                {stockFaible.length + stockRupture.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Aucune alerte de stock pour le moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...stockRupture, ...stockFaible].map((s) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Export pour la période « {periodLabel(rangeFrom, rangeTo)} », selon ce que votre profil peut voir.
      </p>
    </div>
  );
}
