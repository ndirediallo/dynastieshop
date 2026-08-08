import type { Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class InsufficientStockError extends Error {}

type Db = Prisma.TransactionClient | typeof prisma;

interface ApplyStockMovementParams {
  boutiqueId: string;
  variantId: string;
  // Delta signé appliqué au stock : positif pour une entrée, négatif pour
  // une sortie.
  quantity: number;
  type: StockMovementType;
  reason?: string;
  userId?: string | null;
  transferId?: string;
}

async function runMovement(db: Db, params: ApplyStockMovementParams) {
  // S'assure qu'une ligne de stock existe pour ce couple boutique/variante
  // (première entrée pour ce produit dans cette boutique, par exemple).
  await db.stock.upsert({
    where: {
      boutiqueId_variantId: {
        boutiqueId: params.boutiqueId,
        variantId: params.variantId,
      },
    },
    create: { boutiqueId: params.boutiqueId, variantId: params.variantId, quantity: 0 },
    update: {},
  });

  // Mise à jour atomique et conditionnelle en une seule requête : empêche
  // deux opérations concurrentes (ex. deux ventes simultanées) de faire
  // passer le stock sous zéro — il n'y a pas de fenêtre de course entre
  // "lire le stock" et "l'écrire" comme il y en aurait avec un
  // upsert+update séparés.
  const updated = await db.$executeRaw`
    UPDATE "Stock"
    SET quantity = quantity + ${params.quantity}, "updatedAt" = now()
    WHERE "boutiqueId" = ${params.boutiqueId}
      AND "variantId" = ${params.variantId}
      AND quantity + ${params.quantity} >= 0
  `;

  if (updated === 0) {
    throw new InsufficientStockError(
      "Stock insuffisant pour effectuer cette opération."
    );
  }

  return db.stockMovement.create({
    data: {
      boutiqueId: params.boutiqueId,
      variantId: params.variantId,
      type: params.type,
      quantity: params.quantity,
      reason: params.reason,
      userId: params.userId ?? null,
      transferId: params.transferId,
    },
  });
}

// Point d'entrée unique pour toute variation de stock (ventes, achats,
// transferts, ajustements, inventaires, retours) : jamais d'écriture
// directe sur la table Stock ailleurs dans le code (voir section 6 du
// document d'architecture). Si un `tx` est fourni, l'opération rejoint la
// transaction en cours (ex. les N lignes d'une même vente) ; sinon elle
// s'exécute dans sa propre transaction dédiée.
export async function applyStockMovement(
  params: ApplyStockMovementParams,
  tx?: Prisma.TransactionClient
) {
  if (tx) return runMovement(tx, params);
  return prisma.$transaction((trx) => runMovement(trx, params));
}
