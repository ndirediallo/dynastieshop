"use server";

import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { applyStockMovement } from "@/lib/stock";
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

export async function updateCategory(id: string, input: CategoryInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = categorySchema.parse(input);

  const category = await prisma.category.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    action: "CATEGORY_UPDATED",
    entityType: "Category",
    entityId: category.id,
    details: `Catégorie renommée en "${category.name}"`,
  });

  revalidatePath("/produits");
  return category;
}

// On refuse la suppression tant que des produits pointent encore vers
// cette catégorie plutôt que de les en détacher silencieusement — un
// changement de catégorie doit rester une décision visible sur chaque
// produit, pas un effet de bord de la suppression.
export async function deleteCategory(
  id: string
): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("SUPER_ADMIN");

  const [directCount, subCount] = await Promise.all([
    prisma.product.count({ where: { categoryId: id } }),
    prisma.product.count({ where: { subCategory: { categoryId: id } } }),
  ]);
  const productCount = directCount + subCount;
  if (productCount > 0) {
    return {
      error: `Cette catégorie est utilisée par ${productCount} produit(s). Retirez-la de ces produits avant de la supprimer.`,
    };
  }

  const category = await prisma.category.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    action: "CATEGORY_DELETED",
    entityType: "Category",
    entityId: id,
    details: `Catégorie "${category.name}" supprimée`,
  });

  revalidatePath("/produits");
  return { success: true };
}

export async function updateSubCategory(id: string, input: SubCategoryInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = subCategorySchema.parse(input);

  const subCategory = await prisma.subCategory.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    action: "SUBCATEGORY_UPDATED",
    entityType: "SubCategory",
    entityId: subCategory.id,
    details: `Sous-catégorie renommée en "${subCategory.name}"`,
  });

  revalidatePath("/produits");
  return subCategory;
}

export async function deleteSubCategory(
  id: string
): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("SUPER_ADMIN");

  const productCount = await prisma.product.count({ where: { subCategoryId: id } });
  if (productCount > 0) {
    return {
      error: `Cette sous-catégorie est utilisée par ${productCount} produit(s). Retirez-la de ces produits avant de la supprimer.`,
    };
  }

  const subCategory = await prisma.subCategory.delete({ where: { id } });

  await logActivity({
    userId: user.id,
    action: "SUBCATEGORY_DELETED",
    entityType: "SubCategory",
    entityId: id,
    details: `Sous-catégorie "${subCategory.name}" supprimée`,
  });

  revalidatePath("/produits");
  return { success: true };
}

// Un nouvel arrivage se fait en une seule fois : le produit, ses variantes
// et la quantité reçue pour chacune. La quantité atterrit toujours à
// l'entrepôt central (jamais directement dans une boutique — voir la règle
// posée pour le Stock), exactement comme une entrée manuelle depuis
// Stock > Nouveau mouvement, mais sans l'étape séparée.
export async function createProduct(input: ProductInput) {
  const user = await requireRole("SUPER_ADMIN");
  const data = productSchema.parse(input);

  const entrepot = await prisma.boutique.findFirst({ where: { type: "ENTREPOT" } });

  const product = await prisma.$transaction(async (tx) => {
    // Le SKU n'est plus saisi (retiré du formulaire, trop technique) :
    // généré automatiquement. Basé sur le plus grand numéro déjà utilisé
    // plutôt que sur un simple compte de lignes — un produit supprimé
    // ferait sinon retomber le compteur en arrière et regénérer un SKU
    // déjà pris par un produit existant (contrainte unique en base).
    const lastProduct = await tx.product.findFirst({
      where: { sku: { startsWith: "PRD-" } },
      orderBy: { sku: "desc" },
      select: { sku: true },
    });
    const lastNumber = lastProduct ? parseInt(lastProduct.sku.slice(4), 10) || 0 : 0;
    const sku = data.sku?.trim() || `PRD-${String(lastNumber + 1).padStart(4, "0")}`;

    const created = await tx.product.create({
      data: {
        name: data.name,
        sku,
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
      include: { variants: { orderBy: { createdAt: "asc" } } },
    });

    if (entrepot) {
      for (let i = 0; i < created.variants.length; i++) {
        const receivedQuantity = data.variants[i]?.receivedQuantity ?? 0;
        if (receivedQuantity > 0) {
          await applyStockMovement(
            {
              boutiqueId: entrepot.id,
              variantId: created.variants[i].id,
              type: "ENTREE",
              quantity: receivedQuantity,
              reason: "Arrivage à la création du produit",
              userId: user.id,
            },
            tx
          );
        }
      }
    }

    return created;
  });

  const totalReceived = data.variants.reduce((sum, v) => sum + v.receivedQuantity, 0);
  await logActivity({
    userId: user.id,
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    details:
      totalReceived > 0
        ? `Produit "${product.name}" créé avec ${data.variants.length} variante${data.variants.length > 1 ? "s" : ""}, ${totalReceived} unité${totalReceived > 1 ? "s" : ""} reçue${totalReceived > 1 ? "s" : ""} à l'entrepôt`
        : `Produit "${product.name}" créé avec ${data.variants.length} variante${data.variants.length > 1 ? "s" : ""}`,
  });

  revalidatePath("/produits");
  revalidatePath("/stocks");
  revalidatePath("/dashboard");
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

// Une suppression réelle n'est autorisée que si le produit n'a strictement
// aucun historique (jamais vendu, jamais acheté, jamais transféré, jamais
// mouvementé, aucun stock restant) — sinon on préserve l'intégrité des
// ventes/achats passés en refusant, et on renvoie vers la désactivation
// (déjà possible via ToggleActiveButton).
export async function deleteProduct(
  id: string
): Promise<{ error: string } | { success: true }> {
  const user = await requireRole("SUPER_ADMIN");

  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { select: { id: true } } },
  });
  if (!product) {
    return { error: "Produit introuvable." };
  }
  const variantIds = product.variants.map((v) => v.id);

  const [saleCount, poCount, transferCount, movementCount, stockWithQty] = await Promise.all([
    prisma.saleItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.purchaseOrderItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.stockTransferItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.stockMovement.count({ where: { variantId: { in: variantIds } } }),
    prisma.stock.count({ where: { variantId: { in: variantIds }, quantity: { gt: 0 } } }),
  ]);
  if (saleCount + poCount + transferCount + movementCount + stockWithQty > 0) {
    return {
      error:
        "Ce produit a déjà de l'historique (ventes, achats, transferts, mouvements ou stock) : désactivez-le plutôt que de le supprimer.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.stock.deleteMany({ where: { variantId: { in: variantIds } } });
    await tx.product.delete({ where: { id } });
  });

  if (product.photoUrl) {
    try {
      await unlink(path.join(process.cwd(), "public", product.photoUrl));
    } catch {
      // Le fichier peut déjà avoir disparu — ce n'est pas bloquant.
    }
  }

  await logActivity({
    userId: user.id,
    action: "PRODUCT_DELETED",
    entityType: "Product",
    entityId: id,
    details: `Produit "${product.name}" supprimé (aucun historique)`,
  });

  revalidatePath("/produits");
  return { success: true };
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
