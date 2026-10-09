import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, Package } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
import { PageHeader } from "@/components/page-header";
import { SectionIcon } from "@/components/section-icon";
import { cn } from "@/lib/utils";
import { ProductForm } from "../product-form";
import { ProductImageUpload } from "../product-image-upload";

function variantLabel(variant: { color: string | null; size: string | null }) {
  return [variant.color, variant.size].filter(Boolean).join(" / ") || "Référence unique";
}

export default async function ModifierProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect("/produits");
  }

  const { id } = await params;

  const [product, categories, settings, boutiquesRaw] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { subCategories: { orderBy: { name: "asc" } } },
    }),
    getSettings(),
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) {
    notFound();
  }

  // Entrepôt en premier (c'est là que tout arrive), puis les boutiques par
  // ordre alphabétique — répond à "dans quelle boutique ce produit a-t-il
  // été envoyé, et où n'est-il pas encore arrivé".
  const boutiques = [...boutiquesRaw].sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "ENTREPOT" ? -1 : 1
  );
  const entrepot = boutiques.find((b) => b.type === "ENTREPOT");

  const stocks = await prisma.stock.findMany({
    where: { variantId: { in: product.variants.map((v) => v.id) } },
    select: { boutiqueId: true, variantId: true, quantity: true },
  });
  const stockByVariantAndBoutique = new Map<string, number>();
  for (const s of stocks) {
    stockByVariantAndBoutique.set(`${s.variantId}:${s.boutiqueId}`, s.quantity);
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/produits" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        Produits
      </Button>

      <PageHeader
        icon={Package}
        title={`Modifier · ${product.name}`}
        description={`SKU ${product.sku}`}
        tint="blue"
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base font-bold">
            <SectionIcon icon={MapPin} tint="blue" />
            Répartition du stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {product.variants.length > 1 && <TableHead>Variante</TableHead>}
                <TableHead>Emplacement</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.flatMap((variant) =>
                boutiques.map((boutique) => {
                  const quantity =
                    stockByVariantAndBoutique.get(`${variant.id}:${boutique.id}`) ?? 0;
                  const isOut = quantity <= 0;
                  const isLow = !isOut && quantity <= variant.alertThreshold;
                  return (
                    <TableRow key={`${variant.id}:${boutique.id}`}>
                      {product.variants.length > 1 && (
                        <TableCell className="font-medium">{variantLabel(variant)}</TableCell>
                      )}
                      <TableCell>
                        <Link
                          href={`/stocks?boutiqueId=${boutique.id}`}
                          className="text-primary hover:underline"
                        >
                          {boutique.name}
                        </Link>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-figures font-semibold tabular-nums",
                          isOut && "text-destructive",
                          isLow && "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {quantity}
                      </TableCell>
                      <TableCell>
                        {isOut ? (
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImageUpload
            productId={product.id}
            photoUrl={product.photoUrl}
          />
        </CardContent>
      </Card>

      <ProductForm
        categories={categories}
        currency={settings.currency}
        defaultAlertThreshold={settings.defaultAlertThreshold}
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          photoUrl: product.photoUrl,
          description: product.description,
          categoryId: product.categoryId,
          subCategoryId: product.subCategoryId,
          active: product.active,
          variants: product.variants.map((v) => ({
            id: v.id,
            color: v.color,
            size: v.size,
            sku: v.sku,
            barcode: v.barcode,
            purchasePrice: Number(v.purchasePrice),
            sellingPrice: Number(v.sellingPrice),
            alertThreshold: v.alertThreshold,
            active: v.active,
            warehouseQuantity: entrepot
              ? (stockByVariantAndBoutique.get(`${v.id}:${entrepot.id}`) ?? 0)
              : 0,
          })),
        }}
      />
    </div>
  );
}
