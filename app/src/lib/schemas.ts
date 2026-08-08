import { z } from "zod";

// Schémas Zod partagés entre les server actions et les formulaires client
// (un fichier "use server" ne peut exporter que des fonctions async, ces
// schémas doivent donc vivre dans un module séparé).

export const boutiqueSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  type: z.enum(["BOUTIQUE", "ENTREPOT"]),
  address: z.string().optional(),
  phone: z.string().optional(),
});
export type BoutiqueInput = z.infer<typeof boutiqueSchema>;

const phoneField = z
  .string()
  .trim()
  .regex(/^\d{6,15}$/, "Le numéro doit contenir uniquement des chiffres (6 à 15)");

const pinField = z
  .string()
  .regex(/^\d{4}$/, "Le code doit contenir exactement 4 chiffres");

export const userCreateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: phoneField,
  password: pinField,
  role: z.enum(["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"]),
  boutiqueId: z.string().nullable().optional(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: phoneField,
  role: z.enum(["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"]),
  boutiqueId: z.string().nullable().optional(),
  password: pinField.optional().or(z.literal("")),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const settingsSchema = z.object({
  companyName: z.string().min(2, "Le nom de l'entreprise est requis"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Adresse e-mail invalide").optional().or(z.literal("")),
  currency: z.string().min(1, "La devise est requise"),
  invoicePrefix: z.string().min(1, "Le préfixe de facture est requis"),
  invoiceNextNumber: z.number().int().min(1),
  ticketPrefix: z.string().min(1, "Le préfixe de ticket est requis"),
  ticketNextNumber: z.number().int().min(1),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const categorySchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const subCategorySchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  categoryId: z.string().min(1, "La catégorie est requise"),
});
export type SubCategoryInput = z.infer<typeof subCategorySchema>;

// `variantId` n'est présent que pour une variante déjà existante (cas
// d'une modification) — son absence signale une nouvelle variante à créer.
// (Nommé `variantId` et non `id` : react-hook-form réserve le nom `id`
// pour sa propre clé interne dans un `useFieldArray`.)
export const productVariantSchema = z.object({
  variantId: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  purchasePrice: z.number().min(0, "Le prix d'achat doit être positif ou nul"),
  sellingPrice: z.number().min(0, "Le prix de vente doit être positif ou nul"),
  alertThreshold: z.number().int().min(0, "Le seuil d'alerte doit être positif ou nul"),
  active: z.boolean(),
});
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  sku: z.string().min(1, "La référence (SKU) est requise"),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  subCategoryId: z.string().nullable().optional(),
  active: z.boolean(),
  variants: z
    .array(productVariantSchema)
    .min(1, "Ajoutez au moins une variante (même pour un produit sans déclinaison)"),
});
export type ProductInput = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// Stocks
// ---------------------------------------------------------------------------

export const stockMovementSchema = z.object({
  boutiqueId: z.string().min(1, "L'emplacement est requis"),
  variantId: z.string().min(1, "Le produit est requis"),
  type: z.enum(["ENTREE", "SORTIE"]),
  quantity: z.number().int().positive("La quantité doit être supérieure à 0"),
  reason: z.string().optional(),
});
export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const inventorySchema = z.object({
  boutiqueId: z.string().min(1, "L'emplacement est requis"),
  lines: z.array(
    z.object({
      variantId: z.string(),
      countedQuantity: z.number().int().min(0),
    })
  ),
});
export type InventoryInput = z.infer<typeof inventorySchema>;

// ---------------------------------------------------------------------------
// Fournisseurs & Achats
// ---------------------------------------------------------------------------

export const supplierSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().optional(),
  email: z.string().email("Adresse e-mail invalide").optional().or(z.literal("")),
  address: z.string().optional(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const purchaseOrderItemSchema = z.object({
  variantId: z.string().min(1, "Le produit est requis"),
  quantityOrdered: z.number().int().positive("La quantité doit être supérieure à 0"),
  unitCost: z.number().min(0, "Le coût unitaire doit être positif ou nul"),
});
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Le fournisseur est requis"),
  boutiqueId: z.string().min(1, "La destination est requise"),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, "Ajoutez au moins un produit à la commande"),
});
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const receivePurchaseOrderSchema = z.object({
  lines: z.array(
    z.object({
      itemId: z.string(),
      quantityReceivedNow: z.number().int().min(0),
    })
  ),
});
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;

// ---------------------------------------------------------------------------
// Transferts
// ---------------------------------------------------------------------------

export const stockTransferSchema = z.object({
  fromBoutiqueId: z.string().min(1, "L'origine est requise"),
  toBoutiqueId: z.string().min(1, "La destination est requise"),
  items: z.array(
    z.object({
      variantId: z.string().min(1, "Le produit est requis"),
      quantity: z.number().int().positive("La quantité doit être supérieure à 0"),
    })
  ).min(1, "Ajoutez au moins un produit au transfert"),
}).refine((data) => data.fromBoutiqueId !== data.toBoutiqueId, {
  message: "L'origine et la destination doivent être différentes",
  path: ["toBoutiqueId"],
});
export type StockTransferInput = z.infer<typeof stockTransferSchema>;

// ---------------------------------------------------------------------------
// Dépenses
// ---------------------------------------------------------------------------

export const expenseSchema = z.object({
  type: z.string().min(2, "Le type de dépense est requis"),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  date: z.string().min(1, "La date est requise"),
  boutiqueId: z.string().nullable().optional(),
  comment: z.string().optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

// ---------------------------------------------------------------------------
// Ventes
// ---------------------------------------------------------------------------

export const saleItemInputSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive("La quantité doit être supérieure à 0"),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});
export type SaleItemInputType = z.infer<typeof saleItemInputSchema>;

export const paymentInputSchema = z.object({
  method: z.enum(["ESPECES", "ORANGE_MONEY", "WAVE", "CARTE", "VIREMENT"]),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  reference: z.string().optional(),
});
export type PaymentInputType = z.infer<typeof paymentInputSchema>;

export const saleSchema = z.object({
  boutiqueId: z.string().min(1, "La boutique est requise"),
  customerId: z.string().nullable().optional(),
  items: z.array(saleItemInputSchema).min(1, "Le panier est vide"),
  payments: z.array(paymentInputSchema).min(1, "Ajoutez au moins un paiement"),
});
export type SaleInput = z.infer<typeof saleSchema>;

export const saleReturnSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        saleItemId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "Sélectionnez au moins un article à retourner"),
});
export type SaleReturnInput = z.infer<typeof saleReturnSchema>;

export const customerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().optional(),
  email: z.string().email("Adresse e-mail invalide").optional().or(z.literal("")),
  address: z.string().optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;
