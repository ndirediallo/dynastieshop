import { z } from "zod";

// Schémas Zod partagés entre les server actions et les formulaires client
// (un fichier "use server" ne peut exporter que des fonctions async, ces
// schémas doivent donc vivre dans un module séparé).

export const boutiqueSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  type: z.enum(["BOUTIQUE", "ENTREPOT"]),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});
export type BoutiqueInput = z.infer<typeof boutiqueSchema>;

const phoneField = z
  .string()
  .trim()
  .regex(/^\d{6,15}$/, "Le numéro doit contenir uniquement des chiffres (6 à 15)");

const pinField = z
  .string()
  .regex(/^\d{4}$/, "Le mot de passe doit contenir exactement 4 chiffres");

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: phoneField,
  role: z.enum(["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"]),
  boutiqueId: z.string().nullable().optional(),
  extraModules: z.array(z.string()),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: phoneField,
  role: z.enum(["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"]),
  boutiqueId: z.string().nullable().optional(),
  extraModules: z.array(z.string()),
  // Remet le code à sa valeur par défaut ("0000") et force l'utilisateur à
  // en choisir un nouveau à sa prochaine connexion — pas de saisie d'un
  // code arbitraire par le Super Admin (voir discussion : il n'a pas à
  // connaître/retenir le code de quelqu'un d'autre).
  resetPassword: z.boolean().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: pinField,
    newPassword: pinField,
    confirmPassword: pinField,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

// Changement forcé (première connexion / réinitialisation par le Super
// Admin) — pas d'ancien code à confirmer, voir changer-mot-de-passe/actions.ts.
export const pinOnlySchema = z
  .object({
    password: pinField,
    confirmPassword: pinField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });
export type PinOnlyInput = z.infer<typeof pinOnlySchema>;

export const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "Le nom de l'entreprise est requis"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide")
    .optional()
    .or(z.literal("")),
  currency: z.string().trim().min(1, "La devise est requise"),
  invoicePrefix: z.string().trim().min(1, "Le préfixe de facture est requis"),
  invoiceNextNumber: z.number().int().min(1),
  ticketPrefix: z.string().trim().min(1, "Le préfixe de ticket est requis"),
  ticketNextNumber: z.number().int().min(1),
  defaultAlertThreshold: z.number().int().min(0, "Le seuil doit être positif ou nul"),
  maxFailedLoginAttempts: z
    .number()
    .int()
    .min(3, "Minimum 3 essais, sinon un simple mot de passe mal tapé bloque le compte")
    .max(20),
  lockoutDurationMinutes: z.number().int().min(1).max(1440),
  maxDiscountPercent: z.number().int().min(0).max(100),
  activePaymentMethods: z
    .array(z.string())
    .min(1, "Au moins une méthode de paiement doit rester active"),
  defaultDeliveryFee: z.number().int().min(0, "Le montant doit être positif ou nul"),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const subCategorySchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  categoryId: z.string().min(1, "La catégorie est requise"),
});
export type SubCategoryInput = z.infer<typeof subCategorySchema>;

// `variantId` n'est présent que pour une variante déjà existante (cas
// d'une modification) — son absence signale une nouvelle variante à créer.
// (Nommé `variantId` et non `id` : react-hook-form réserve le nom `id`
// pour sa propre clé interne dans un `useFieldArray`.)
export const productVariantSchema = z.object({
  variantId: z.string().optional(),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  purchasePrice: z.number().min(0, "Le prix d'achat doit être positif ou nul"),
  sellingPrice: z.number().min(0, "Le prix de vente doit être positif ou nul"),
  alertThreshold: z.number().int().min(0, "Le seuil d'alerte doit être positif ou nul"),
  active: z.boolean(),
  // Quantité reçue à l'arrivage, utilisée uniquement à la création d'un
  // produit : createProduct s'en sert pour générer l'entrée de stock à
  // l'entrepôt central (jamais utilisée par updateProduct — modifier un
  // produit ne touche jamais au stock, voir §6 du document d'architecture).
  // Pas de `.default()` ici : ça introduirait un écart entre le type
  // d'entrée et de sortie de Zod, incompatible avec le typage strict de
  // react-hook-form — le formulaire fournit donc toujours 0 explicitement.
  receivedQuantity: z.number().int().min(0),
});
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  // Ni la référence (SKU) ni le code-barres ne sont saisis par
  // l'utilisateur (retirés du formulaire — trop techniques pour un usage
  // courant) : le SKU produit est généré automatiquement à la création
  // (voir createProduct), le code-barres reste simplement vide.
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  description: z.string().trim().optional(),
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
  reason: z.string().trim().optional(),
});
export type StockMovementInput = z.infer<typeof stockMovementSchema>;

// Raccourci "Envoyer vers une boutique" depuis le Stock global : crée et
// valide un transfert entrepôt → boutique en un seul geste (voir
// quickRestockBoutique). L'origine est toujours l'entrepôt, déduite côté
// serveur — pas besoin de la demander ici.
export const quickRestockSchema = z.object({
  variantId: z.string().min(1, "Le produit est requis"),
  toBoutiqueId: z.string().min(1, "Choisissez une boutique"),
  quantity: z.number().int().positive("La quantité doit être supérieure à 0"),
});
export type QuickRestockInput = z.infer<typeof quickRestockSchema>;

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
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
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

export const supplierPaymentSchema = z.object({
  method: z.enum(["ESPECES", "ORANGE_MONEY", "MTN_MONEY", "WAVE", "CARTE", "VIREMENT"]),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
});
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;

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
  type: z.string().trim().min(2, "Le type de dépense est requis"),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  date: z.string().min(1, "La date est requise"),
  boutiqueId: z.string().nullable().optional(),
  comment: z.string().trim().optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const fixedExpenseSchema = z.object({
  label: z.string().trim().min(2, "Le libellé est requis"),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  boutiqueId: z.string().nullable().optional(),
});
export type FixedExpenseInput = z.infer<typeof fixedExpenseSchema>;

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
  method: z.enum(["ESPECES", "ORANGE_MONEY", "MTN_MONEY", "WAVE", "CARTE", "VIREMENT"]),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  reference: z.string().trim().optional(),
});
export type PaymentInputType = z.infer<typeof paymentInputSchema>;

// Une vente à crédit (revendeur qui paie plus tard) autorise un paiement
// partiel — voire nul — à la création, mais exige toujours un client
// identifié (pas de crédit anonyme). Une vente normale garde la règle
// stricte : au moins un paiement, dont le total doit couvrir exactement le
// montant du panier (vérifié dans createSale).
export const saleSchema = z
  .object({
    boutiqueId: z.string().min(1, "La boutique est requise"),
    customerId: z.string().nullable().optional(),
    isCredit: z.boolean().optional().default(false),
    items: z.array(saleItemInputSchema).min(1, "Le panier est vide"),
    payments: z.array(paymentInputSchema),
    deliveryFee: z.number().min(0).optional().default(0),
  })
  .refine((data) => data.isCredit || data.payments.length >= 1, {
    message: "Ajoutez au moins un paiement",
    path: ["payments"],
  })
  .refine((data) => !data.isCredit || !!data.customerId, {
    message: "Un client est requis pour une vente à crédit",
    path: ["customerId"],
  });
export type SaleInput = z.infer<typeof saleSchema>;

export const creditRepaymentSchema = z.object({
  method: z.enum(["ESPECES", "ORANGE_MONEY", "MTN_MONEY", "WAVE", "CARTE", "VIREMENT"]),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
});
export type CreditRepaymentInput = z.infer<typeof creditRepaymentSchema>;

export const saleReturnSchema = z
  .object({
    saleId: z.string().min(1),
    reason: z.string().trim().optional(),
    items: z
      .array(
        z.object({
          saleItemId: z.string().min(1),
          quantity: z.number().int().positive(),
        })
      )
      .min(1, "Sélectionnez au moins un article à retourner"),
    // Si asStoreCredit est faux, un remboursement a réellement lieu
    // maintenant et doit préciser comment (voir refine ci-dessous).
    asStoreCredit: z.boolean().default(false),
    refundMethod: z
      .enum(["ESPECES", "ORANGE_MONEY", "MTN_MONEY", "WAVE", "CARTE", "VIREMENT"])
      .nullable(),
  })
  .refine((data) => data.asStoreCredit || !!data.refundMethod, {
    message: "Choisissez un moyen de remboursement, ou optez pour un avoir.",
    path: ["refundMethod"],
  });
export type SaleReturnInput = z.infer<typeof saleReturnSchema>;

export const updateSaleItemSchema = z.object({
  quantity: z.number().int().positive("La quantité doit être supérieure à 0"),
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
});
export type UpdateSaleItemInput = z.infer<typeof updateSaleItemSchema>;

export const saleEditRequestSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(5, "Décrivez le problème (5 caractères minimum)"),
});
export type SaleEditRequestInput = z.infer<typeof saleEditRequestSchema>;

export const resolveRequestSchema = z.object({
  approve: z.boolean(),
  resolutionNote: z.string().trim().optional(),
});
export type ResolveRequestInput = z.infer<typeof resolveRequestSchema>;

export const restockRequestSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive().optional().nullable(),
  note: z.string().trim().optional(),
});
export type RestockRequestInput = z.infer<typeof restockRequestSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères"),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;
