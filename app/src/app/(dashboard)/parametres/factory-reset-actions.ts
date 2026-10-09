"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { RESET_CONFIRMATION_PHRASE } from "./factory-reset-constants";

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "0000";

// Remise à zéro complète avant livraison à un client réel : vide toutes les
// données opérationnelles (produits, ventes, stocks, clients, fournisseurs,
// transferts, dépenses, boutiques, comptes utilisateurs) et ne garde que
// Settings (coordonnées de l'entreprise déjà saisies) et le compte Super
// Admin qui déclenche l'opération — remis lui-même au mot de passe par
// défaut, à changer à la prochaine connexion. Irréversible : aucune
// corbeille, aucune sauvegarde automatique — c'est voulu, ce n'est pas une
// action du quotidien (voir discussion avec l'utilisateur : standard avant
// de livrer à une cliente, jamais déclenchable par erreur grâce à la phrase
// de confirmation exacte exigée par l'appelant).
export async function factoryReset(confirmPhrase: string) {
  const user = await requireRole("SUPER_ADMIN");

  if (confirmPhrase !== RESET_CONFIRMATION_PHRASE) {
    throw new Error("Phrase de confirmation incorrecte.");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    // 1) Ventes et tout ce qui en dépend (retours avant ventes : un
    // SaleReturnItem référence SaleItem sans cascade, donc le retour doit
    // partir avant que la vente n'entraîne ses lignes en cascade).
    await tx.saleEditRequest.deleteMany({});
    await tx.saleReturn.deleteMany({});
    await tx.sale.deleteMany({}); // cascade: SaleItem, Payment

    // 2) Transferts et réapprovisionnements (avant StockTransfer, qui les
    // référence et n'entraîne aucun des deux en cascade).
    await tx.restockRequest.deleteMany({});
    await tx.stockMovement.deleteMany({});
    await tx.stockTransfer.deleteMany({}); // cascade: StockTransferItem

    // 3) Commandes fournisseurs (cascade: PurchaseOrderItem, SupplierPayment).
    await tx.purchaseOrder.deleteMany({});

    // 4) Inventaires et stock.
    await tx.inventorySession.deleteMany({}); // cascade: InventorySessionLine
    await tx.stock.deleteMany({});

    // 5) Dépenses (avant FixedExpense, qu'elles référencent).
    await tx.expense.deleteMany({});
    await tx.fixedExpense.deleteMany({});

    // 6) Journal d'activité — repart propre, une seule entrée marquera la
    // réinitialisation elle-même juste après, hors transaction.
    await tx.activityLog.deleteMany({});

    // 7) Catalogue produits (cascade: ProductVariant) puis catégories
    // (cascade: SubCategory) — sûr maintenant que plus rien ne référence
    // de variante (Stock/SaleItem/PurchaseOrderItem/StockMovement/
    // StockTransferItem/InventorySessionLine/RestockRequest sont déjà vides).
    await tx.product.deleteMany({});
    await tx.category.deleteMany({});

    // 8) Annuaires partagés.
    await tx.customer.deleteMany({});
    await tx.supplier.deleteMany({});

    // 9) Comptes utilisateurs — on détache d'abord le compte Super Admin
    // qui déclenche l'opération de sa boutique (le champ est nullable),
    // sinon la suppression des boutiques juste après échouerait sur sa
    // propre ligne. Tout le reste qui référençait un utilisateur a déjà
    // disparu aux étapes précédentes.
    await tx.user.update({ where: { id: user.id }, data: { boutiqueId: null } });
    await tx.user.deleteMany({ where: { id: { not: user.id } } });

    // 10) Boutiques et entrepôt — plus aucune référence entrante à ce stade.
    await tx.boutique.deleteMany({});

    // 11) Le compte restant repart avec le mot de passe par défaut, à
    // changer obligatoirement à la prochaine connexion (middleware.ts) —
    // la cliente ne doit jamais hériter d'un code choisi par le développeur.
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  });

  await logActivity({
    userId: user.id,
    action: "FACTORY_RESET",
    entityType: "System",
    details: `Réinitialisation complète effectuée par ${user.name} avant mise en ligne. Toutes les données opérationnelles ont été vidées.`,
  });

  revalidatePath("/", "layout");
}
