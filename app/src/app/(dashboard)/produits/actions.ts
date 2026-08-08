"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import {
  categorySchema,
  subCategorySchema,
  productSchema,
  type CategoryInput,
  type SubCategoryInput,
  type ProductInput,
} from "@/lib/schemas";

export async function createCategory(input: CategoryInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = categorySchema.parse(input);

  const category = await prisma.category.create({ data });

  await logActivity({
    userId: user.id,
    action: "CATEGORY_CREATED",
    entityType: "Category",
    entityId: category.id,
    details: `Catégorie "${category.name}" créée`,
  });

  revalidatePath("/produits");
  return category;
}

export async function createSubCategory(input: SubCategoryInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = subCategorySchema.parse(input);

  const subCategory = await prisma.subCategory.create({ data });

  await logActivity({
    userId: user.id,
    action: "SUBCATEGORY_CREATED",
    entityType: "SubCategory",
    entityId: subCategory.id,
    details: `Sous-catégorie "${subCategory.name}" créée`,
  });

  revalidatePath("/produits");
  return subCategory;
}

export async function createProduct(input: ProductInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = productSchema.parse(input);

  const product = await prisma.product.create({
    data: {
      name: data.name,
      sku: data.sku,
      barcode: data.barcode || null,
      description: data.description || null,
      categoryId: data.categoryId || null,
      subCategoryId: data.subCategoryId || null,
      active: data.active,
      variants: {
        create: data.variants.map((v) => ({
          color: v.color || null,
          size: v.size || null,
          sku: v.sku || null,
          barcode: v.barcode || null,
          purchasePrice: v.purchasePrice,
          sellingPrice: v.sellingPrice,
          alertThreshold: v.alertThreshold,
          active: v.active,
        })),
      },
    },
  });

  await logActivity({
    userId: user.id,
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    details: `Produit "${product.name}" créé avec ${data.variants.length} variante(s)`,
  });

  revalidatePath("/produits");
  return { id: product.id };
}

// Les variantes déjà existantes ne sont jamais supprimées ici (elles peuvent
// être référencées par des ventes, achats ou mouvements de stock) : on les
// met à jour, et on n'ajoute que les nouvelles. Pour retirer une variante de
// la vente, on la désactive (`active: false`).
export async function updateProduct(id: string, input: ProductInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = productSchema.parse(input);

  const existingVariants = await prisma.productVariant.findMany({
    where: { productId: id },
    select: { id: true },
  });
  const existingVariantIds = new Set(existingVariants.map((v) => v.id));

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || null,
        description: data.description || null,
        categoryId: data.categoryId || null,
        subCategoryId: data.subCategoryId || null,
        active: data.active,
      },
    });

    for (const variant of data.variants) {
      const variantData = {
        color: variant.color || null,
        size: variant.size || null,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        purchasePrice: variant.purchasePrice,
        sellingPrice: variant.sellingPrice,
        alertThreshold: variant.alertThreshold,
        active: variant.active,
      };

      if (variant.variantId && existingVariantIds.has(variant.variantId)) {
        await tx.productVariant.update({
          where: { id: variant.variantId },
          data: variantData,
        });
      } else {
        await tx.productVariant.create({
          data: { ...variantData, productId: id },
        });
      }
    }
  });

  await logActivity({
    userId: user.id,
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: id,
    details: `Produit "${data.name}" modifié`,
  });

  revalidatePath("/produits");
  revalidatePath(`/produits/${id}`);
  return { id };
}

export async function toggleProductActive(id: string, active: boolean) {
  const user = await requireRole("SUPER_ADMIN");

  const product = await prisma.product.update({
    where: { id },
    data: { active },
  });

  await logActivity({
    userId: user.id,
    action: active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    entityType: "Product",
    entityId: product.id,
    details: `Produit "${product.name}" ${active ? "activé" : "désactivé"}`,
  });

  revalidatePath("/produits");
  return { id: product.id };
}

export async function uploadProductImage(productId: string, formData: FormData) {
  const user = await requireRole("SUPER_ADMIN");
  const file = formData.get("image") as File | null;

  if (!file || file.size === 0) {
    throw new Error("Aucun fichier fourni");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier doit être une image");
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "produits");
  await mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${productId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  const photoUrl = `/uploads/produits/${filename}`;
  const product = await prisma.product.update({
    where: { id: productId },
    data: { photoUrl },
  });

  await logActivity({
    userId: user.id,
    action: "PRODUCT_IMAGE_UPDATED",
    entityType: "Product",
    entityId: product.id,
    details: `Image du produit "${product.name}" mise à jour`,
  });

  revalidatePath("/produits");
  revalidatePath(`/produits/${productId}`);
  return { photoUrl };
}
