import Link from "next/link";
import { Pencil, Plus, Package, CheckCircle2, TriangleAlert, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { ToggleActiveButton } from "./toggle-active-button";
import { StockBreakdownDialog } from "./stock-breakdown-dialog";
import { RestockRequestDialog } from "./restock-request-dialog";
import { deleteProduct } from "./actions";

function variantLabel(variant: { color: string | null; size: string | null }) {
  return [variant.color, variant.size].filter(Boolean).join(" / ") || "Référence unique";
}

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;

  const [session, settings, products, categories, boutiquesRaw] = await Promise.all([
    auth(),
    getSettings(),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        variants: {
          select: {
            id: true,
            active: true,
            color: true,
            size: true,
            purchasePrice: true,
            sellingPrice: true,
            alertThreshold: true,
            stocks: { select: { quantity: true, boutiqueId: true } },
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { subCategories: { orderBy: { name: "asc" } } },
    }),
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  // Le prix d'achat (et toute valeur qui en dérive, comme la valorisation
  // du stock) ne doit jamais être visible par un Caissier — seul le prix de
  // vente et la disponibilité du stock le concernent.
  const canSeePurchasePrice = session?.user?.role !== "CAISSIER";
  // Un Caissier voit si un produit est disponible dans une AUTRE boutique
  // (même équipe, utile pour orienter un client) mais pas la répartition à
  // l'entrepôt, qui ne le concerne pas et n'est pas son terrain.
  const canSeeEntrepotBreakdown = session?.user?.role !== "CAISSIER";
  const canOpenStocksPage = session?.user?.role ? session.user.role !== "CAISSIER" : false;
  const isCaissier = session?.user?.role === "CAISSIER";
  const viewerBoutiqueId = session?.user?.boutiqueId ?? null;
  const scopedProducts = categoryId
    ? products.filter((p) => p.categoryId === categoryId)
    : products;

  // Entrepôt en premier (c'est là que tout arrive), puis les boutiques par
  // ordre alphabétique — voir /produits/[id] pour la même convention.
  const boutiques = [...boutiquesRaw]
    .filter((b) => canSeeEntrepotBreakdown || b.type !== "ENTREPOT")
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "ENTREPOT" ? -1 : 1
    );

  // Calculée une seule fois par produit — réutilisée à la fois par la
  // bande de résumé et par la grille, pour ne pas refaire les mêmes sommes
  // deux fois.
  const filteredProducts = scopedProducts.map((product) => {
    const activeVariants = product.variants.filter((v) => v.active);
    const totalStock = product.variants.reduce(
      (sum, v) => sum + v.stocks.reduce((s, st) => s + st.quantity, 0),
      0
    );
    const stockValue = product.variants.reduce(
      (sum, v) =>
        sum + v.stocks.reduce((s, st) => s + st.quantity, 0) * Number(v.purchasePrice),
      0
    );
    const prices = activeVariants.map((v) => Number(v.sellingPrice));
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;
    const priceLabel =
      minPrice === null
        ? null
        : minPrice === maxPrice
          ? minPrice.toLocaleString()
          : `dès ${minPrice.toLocaleString()}`;
    const restockVariantOptions = activeVariants.map((v) => ({
      id: v.id,
      label: variantLabel(v),
      stockHere: viewerBoutiqueId
        ? (v.stocks.find((st) => st.boutiqueId === viewerBoutiqueId)?.quantity ?? 0)
        : 0,
    }));
    const stockBreakdownRows = product.variants.flatMap((v) =>
      boutiques.map((b) => ({
        variantLabel: variantLabel(v),
        boutiqueId: b.id,
        boutiqueName: b.name,
        quantity: v.stocks.find((st) => st.boutiqueId === b.id)?.quantity ?? 0,
        alertThreshold: v.alertThreshold,
      }))
    );

    return {
      ...product,
      activeVariants,
      totalStock,
      stockValue,
      priceLabel,
      stockBreakdownRows,
      restockVariantOptions,
      outOfStock: totalStock <= 0,
    };
  });

  const activeCount = filteredProducts.filter((p) => p.active).length;
  const outOfStockCount = filteredProducts.filter((p) => p.active && p.outOfStock).length;
  const totalStockValue = filteredProducts.reduce((sum, p) => sum + p.stockValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Produits"
        description="Catalogue et variantes (couleur / taille) de DYNASTIE SHOP"
        tint="blue"
        actions={
          isSuperAdmin && (
            <>
              <CategoryManagerDialog categories={categories} />
              <Button nativeButton={false} render={<Link href="/produits/nouveau" />}>
                <Plus className="mr-2 size-4" />
                Nouvel arrivage
              </Button>
            </>
          )
        }
      />

      <div className={cn("grid grid-cols-2 gap-4", canSeePurchasePrice && "sm:grid-cols-4")}>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div>
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Produits</p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
              {filteredProducts.length}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm">
            <Package className="size-4" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Actifs</p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {activeCount} / {filteredProducts.length}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
            <CheckCircle2 className="size-4" />
          </span>
        </div>

        {/* Toujours rouge, même à 0 — "en rupture" reste une alerte par
            nature, pas un état qui devient "positif" selon le chiffre (voir
            discussion : couleur fixe, comme sur le tableau de bord boutique). */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div>
            <p className="text-xs font-bold text-destructive">En rupture</p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums text-destructive">
              {outOfStockCount}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive text-white shadow-sm">
            <TriangleAlert className="size-4" />
          </span>
        </div>

        {canSeePurchasePrice && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-bold text-primary">Valeur totale du stock</p>
              <p className="mt-1 whitespace-nowrap font-figures text-2xl font-bold tabular-nums text-primary">
                {totalStockValue.toLocaleString()} {settings.currency}
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Wallet className="size-4" />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
        </p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
            <Button
              variant={!categoryId ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/produits" />}
            >
              Tous
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={categoryId === c.id ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                nativeButton={false}
                render={<Link href={`/produits?categoryId=${c.id}`} />}
              >
                {c.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Package className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun produit {categoryId ? "dans cette catégorie" : "enregistré pour le moment"}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((product) => {
            const { activeVariants, totalStock, priceLabel, outOfStock } = product;

            return (
              <div
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  <ProductThumbnail
                    name={product.name}
                    photoUrl={product.photoUrl}
                    rounded=""
                    className="absolute inset-0 text-3xl"
                  />
                  {!product.active && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                      <Badge variant="secondary">Désactivé</Badge>
                    </div>
                  )}
                  {product.active && outOfStock && (
                    <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white shadow">
                      Rupture
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div>
                    <p className="line-clamp-2 text-base font-semibold leading-snug">
                      {product.name}
                    </p>
                    <p className="font-figures text-xs text-muted-foreground">
                      {product.sku}
                    </p>
                  </div>

                  {product.category && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs font-normal">
                        {product.category.name}
                        {product.subCategory ? ` / ${product.subCategory.name}` : ""}
                      </Badge>
                    </div>
                  )}

                  {priceLabel && (
                    <p className="whitespace-nowrap font-figures text-lg font-bold tabular-nums text-primary">
                      {priceLabel} {settings.currency}
                    </p>
                  )}

                  <p
                    className={cn(
                      "text-sm",
                      outOfStock ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {totalStock} en stock · {activeVariants.length} variante
                    {activeVariants.length > 1 ? "s" : ""}
                  </p>

                  <div className="mt-auto flex items-center justify-between border-t pt-3">
                    {isSuperAdmin ? (
                      <ToggleActiveButton id={product.id} active={product.active} />
                    ) : (
                      <span />
                    )}
                    <div className="flex items-center gap-1">
                      <StockBreakdownDialog
                        productName={product.name}
                        rows={product.stockBreakdownRows}
                        multipleVariants={product.variants.length > 1}
                        boutiqueLinksEnabled={canOpenStocksPage}
                      />
                      {isCaissier && product.restockVariantOptions.length > 0 && (
                        <RestockRequestDialog
                          productName={product.name}
                          variants={product.restockVariantOptions}
                        />
                      )}
                      {isSuperAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            nativeButton={false}
                            render={<Link href={`/produits/${product.id}`} />}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDeleteButton
                            onConfirm={deleteProduct.bind(null, product.id)}
                            title={`Supprimer "${product.name}" ?`}
                            description="Impossible si ce produit a déjà des ventes, achats, transferts ou du stock. Désactivez-le dans ce cas plutôt que de le supprimer."
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
