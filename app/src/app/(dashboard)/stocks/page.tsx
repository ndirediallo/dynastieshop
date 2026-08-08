import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
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
import { MovementDialog } from "./movement-dialog";

function variantLabel(product: { name: string }, variant: { color: string | null; size: string | null }) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function StocksPage({
  searchParams,
}: {
  searchParams: Promise<{ boutiqueId?: string }>;
}) {
  await requirePageAccess("stocks");
  const { boutiqueId } = await searchParams;

  const [boutiques, stocks, variants] = await Promise.all([
    prisma.boutique.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.stock.findMany({
      where: boutiqueId ? { boutiqueId } : undefined,
      include: {
        boutique: { select: { name: true } },
        variant: { include: { product: { select: { name: true } } } },
      },
      orderBy: [{ boutique: { name: "asc" } }, { variant: { product: { name: "asc" } } }],
    }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { name: true } } },
      orderBy: { product: { name: "asc" } },
    }),
  ]);

  const variantOptions = variants.map((v) => ({
    id: v.id,
    label: variantLabel(v.product, v),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stocks</h1>
          <p className="text-sm text-muted-foreground">
            Quantités disponibles par boutique et par entrepôt.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/stocks/inventaire" />}>
            <ClipboardList className="mr-2 size-4" />
            Faire un inventaire
          </Button>
          <MovementDialog boutiques={boutiques} variants={variantOptions} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">{stocks.length} ligne(s) de stock</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!boutiqueId ? "secondary" : "ghost"}
              size="sm"
              nativeButton={false} render={<Link href="/stocks" />}
            >
              Tous
            </Button>
            {boutiques.map((b) => (
              <Button
                key={b.id}
                variant={boutiqueId === b.id ? "secondary" : "ghost"}
                size="sm"
                nativeButton={false} render={<Link href={`/stocks?boutiqueId=${b.id}`} />}
              >
                {b.name}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emplacement</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Seuil d&apos;alerte</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucun stock enregistré pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                stocks.map((stock) => {
                  const isOutOfStock = stock.quantity <= 0;
                  const isLow =
                    !isOutOfStock && stock.quantity <= stock.variant.alertThreshold;
                  return (
                    <TableRow key={stock.id}>
                      <TableCell>{stock.boutique.name}</TableCell>
                      <TableCell className="font-medium">
                        {variantLabel(stock.variant.product, stock.variant)}
                      </TableCell>
                      <TableCell>{stock.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {stock.variant.alertThreshold}
                      </TableCell>
                      <TableCell>
                        {isOutOfStock ? (
                          <Badge variant="destructive">Rupture</Badge>
                        ) : isLow ? (
                          <Badge variant="secondary">Stock faible</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
