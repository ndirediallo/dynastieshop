"use client";

import { useMemo, useState } from "react";
import { Search, Boxes, TriangleAlert, Wallet, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { QuickRestockDialog } from "./quick-restock-dialog";

interface StockLine {
  id: string;
  variantId: string;
  label: string;
  quantity: number;
  alertThreshold: number;
  purchasePrice: number;
  // Renseigné uniquement en vue agrégée toutes-boutiques (voir
  // `showBoutiqueColumn` ci-dessous) — une ligne de stock normale, propre à
  // un seul emplacement, n'a pas besoin de préciser lequel.
  boutiqueName?: string;
}

type StatusFilter = "all" | "rupture" | "faible";

export function StockOverview({
  stocks,
  isEntrepotView,
  shopOptions,
  currency,
  canSeeValue = true,
  showBoutiqueColumn = false,
}: {
  stocks: StockLine[];
  isEntrepotView: boolean;
  shopOptions: { id: string; name: string }[];
  currency: string;
  // Le prix d'achat (et toute valeur qui en dérive) ne doit jamais être
  // visible par un Caissier — voir produits/page.tsx pour la même règle.
  canSeeValue?: boolean;
  // Vue agrégée "alertes toutes boutiques" (voir /stocks?alert=1) : chaque
  // ligne peut venir d'un emplacement différent, donc on précise lequel.
  showBoutiqueColumn?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const ruptureCount = stocks.filter((s) => s.quantity <= 0).length;
  const lowStockCount = stocks.filter(
    (s) => s.quantity > 0 && s.quantity <= s.alertThreshold
  ).length;
  const stockValue = stocks.reduce((sum, s) => sum + s.quantity * s.purchasePrice, 0);

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stocks.filter((s) => {
      const isOut = s.quantity <= 0;
      const isLow = !isOut && s.quantity <= s.alertThreshold;
      if (statusFilter === "rupture" && !isOut) return false;
      if (statusFilter === "faible" && !isLow) return false;
      if (q && !s.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stocks, statusFilter, search]);

  const toggleStatus = (value: StatusFilter) =>
    setStatusFilter((prev) => (prev === value ? "all" : value));

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-4", canSeeValue && "sm:grid-cols-4")}>
        <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Références</p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums">
              {stocks.length}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-600 text-white shadow-sm">
            <Boxes className="size-4" />
          </span>
        </div>

        <button
          type="button"
          onClick={() => toggleStatus("rupture")}
          className={cn(
            "flex items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-left transition-colors hover:bg-destructive/10",
            statusFilter === "rupture" && "ring-2 ring-destructive/60"
          )}
        >
          <div>
            <p className="text-xs font-bold text-destructive">En rupture</p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums text-destructive">
              {ruptureCount}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-white shadow-sm">
            <TriangleAlert className="size-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => toggleStatus("faible")}
          className={cn(
            "flex items-start justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left transition-colors hover:bg-amber-500/10",
            statusFilter === "faible" && "ring-2 ring-amber-500/60"
          )}
        >
          <div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Stock faible
            </p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
              {lowStockCount}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
            <TriangleAlert className="size-4" />
          </span>
        </button>

        {canSeeValue && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-bold text-primary">Valeur du stock</p>
              <p className="mt-1 whitespace-nowrap font-figures text-2xl font-bold tabular-nums text-primary">
                {stockValue.toLocaleString()} {currency}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Wallet className="size-4" />
            </span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {filteredStocks.length} ligne{filteredStocks.length > 1 ? "s" : ""} de stock
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {statusFilter === "rupture" ? "Rupture" : "Stock faible"}
                <X className="size-3" />
              </button>
            )}
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                {showBoutiqueColumn && <TableHead>Boutique</TableHead>}
                <TableHead>Quantité</TableHead>
                <TableHead>Seuil d&apos;alerte</TableHead>
                <TableHead>Statut</TableHead>
                {isEntrepotView && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStocks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4 + (isEntrepotView ? 1 : 0) + (showBoutiqueColumn ? 1 : 0)}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {stocks.length === 0
                      ? "Aucun stock enregistré pour le moment."
                      : "Aucun résultat pour ce filtre."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStocks.map((stock) => {
                  const isOutOfStock = stock.quantity <= 0;
                  const isLow = !isOutOfStock && stock.quantity <= stock.alertThreshold;
                  return (
                    <TableRow
                      key={stock.id}
                      className={cn(
                        isOutOfStock && "bg-destructive/5",
                        isLow && "bg-amber-500/5"
                      )}
                    >
                      <TableCell className="font-medium">{stock.label}</TableCell>
                      {showBoutiqueColumn && (
                        <TableCell className="text-muted-foreground">
                          {stock.boutiqueName ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="font-figures font-semibold tabular-nums">
                        {stock.quantity}
                      </TableCell>
                      <TableCell className="font-figures tabular-nums text-muted-foreground">
                        {stock.alertThreshold}
                      </TableCell>
                      <TableCell>
                        {isOutOfStock ? (
                          <Badge variant="destructive">Rupture</Badge>
                        ) : isLow ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          >
                            Stock faible
                          </Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                      {isEntrepotView && (
                        <TableCell className="text-right">
                          {stock.quantity > 0 && shopOptions.length > 0 && (
                            <QuickRestockDialog
                              variantId={stock.variantId}
                              variantLabel={stock.label}
                              maxQuantity={stock.quantity}
                              boutiques={shopOptions}
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
