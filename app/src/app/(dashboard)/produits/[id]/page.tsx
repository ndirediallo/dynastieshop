import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductForm } from "../product-form";
import { ProductImageUpload } from "../product-image-upload";

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

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { subCategories: { orderBy: { name: "asc" } } },
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier — {product.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          SKU {product.sku}
        </p>
      </div>

      <Card>
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
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
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
          })),
        }}
      />
    </div>
  );
}
