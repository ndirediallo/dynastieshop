import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

export const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
];

export function getFromDate(period: string | undefined) {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "month":
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

// Toujours les dates exactes, jamais le nom du préréglage ("Ce mois",
// "Cette année"...) : un rapport imprimé ou archivé doit se suffire à
// lui-même — une étiquette relative ne veut plus rien dire une fois sortie
// de son contexte (voir discussion avec l'utilisateur). `from`/`to` sont
// donc toujours les dates RÉSOLUES (celles réellement utilisées pour filtrer
// les données, voir getReportData ci-dessous), pas le préréglage choisi.
export function periodLabel(from: Date, to: Date) {
  const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR").format(d);
  return from.toDateString() === to.toDateString()
    ? fmt(from)
    : `Du ${fmt(from)} au ${fmt(to)}`;
}

export function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

// Centralise exactement le même calcul que la page /rapports, pour que
// l'export (CSV + PDF) montre toujours les mêmes chiffres que ce qui est
// affiché à l'écran — un seul endroit où ce calcul peut diverger.
export async function getReportData(
  period: string | undefined,
  user: { id: string; role: Role; boutiqueId?: string | null; extraModules?: string[] },
  // Plage personnalisée (archives) : prioritaire sur `period` dès que l'une
  // des deux dates est renseignée — voir periodLabel ci-dessus pour le même
  // principe appliqué à l'affichage.
  customRange?: { from?: string; to?: string }
) {
  const hasCustomRange = !!customRange?.from || !!customRange?.to;
  // Borne haute toujours résolue, même pour un préréglage ("Ce mois" va
  // donc de son 1er jour à aujourd'hui, pas jusqu'à la fin du mois — on ne
  // montre jamais une plage qui dépasse les données réellement filtrées).
  const from = hasCustomRange
    ? customRange!.from
      ? new Date(`${customRange!.from}T00:00:00`)
      : new Date(0)
    : getFromDate(period);
  const to =
    hasCustomRange && customRange!.to
      ? new Date(`${customRange!.to}T23:59:59.999`)
      : new Date();
  const extra = user.extraModules ?? [];

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  // can() couvre à la fois l'accès par défaut du rôle ET un accès
  // supplémentaire accordé (ex. "ventes" donné à un Logistique) — jamais
  // de condition de rôle codée en dur ici, sinon un accès coché ne
  // produirait aucun effet sur cette page (bug distinct de la fuite
  // inverse : sous-accorder au lieu de sur-accorder).
  const isCaissier = user.role === "CAISSIER";
  const isLogistique = user.role === "LOGISTIQUE";
  const showSales = can(user.role, "ventes", extra);
  const showStock = can(user.role, "stocks", extra);
  const showFournisseurs = can(user.role, "fournisseurs", extra);
  const showFinance = isSuperAdmin;
  // Toute personne qui n'est pas Super Admin ne voit que les ventes/stocks/
  // achats de SA boutique — qu'elle y ait accès par son rôle ou par un
  // accès supplémentaire, jamais la vue complète (voir aussi
  // /ventes/historique, le tableau de bord, /stocks, /fournisseurs : même
  // règle partout).
  const boutiqueScope = !isSuperAdmin && user.boutiqueId ? { boutiqueId: user.boutiqueId } : {};
  const dateRange = { gte: from, lte: to };

  const [sales, expenses, purchaseOrders, stocks] = await Promise.all([
    showSales
      ? prisma.sale.findMany({
          where: {
            createdAt: dateRange,
            ...boutiqueScope,
          },
          include: {
            boutique: { select: { name: true } },
            items: {
              include: { variant: { include: { product: { select: { name: true } } } } },
            },
          },
        })
      : Promise.resolve([]),
    showFinance
      ? prisma.expense.findMany({ where: { date: dateRange } })
      : Promise.resolve([]),
    showFournisseurs
      ? prisma.purchaseOrder.findMany({
          where: { createdAt: dateRange, ...boutiqueScope },
          include: { items: true },
        })
      : Promise.resolve([]),
    showStock
      ? prisma.stock.findMany({
          where: boutiqueScope,
          include: {
            boutique: { select: { name: true } },
            variant: { include: { product: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const caTotal = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  // Déjà inclus dans caTotal/totalAmount (réellement encaissé) mais tracké
  // à part : l'utilisateur veut savoir combien la livraison a généré sur la
  // période, pas juste deviner une part du chiffre d'affaires global.
  const revenuLivraison = sales.reduce((sum, s) => sum + Number(s.deliveryFee), 0);
  const margeEstimee = sales.reduce(
    (sum, s) =>
      sum +
      s.items.reduce(
        (itemSum, item) =>
          itemSum +
          (item.quantity * Number(item.unitPrice) -
            Number(item.discount) -
            item.quantity * Number(item.variant.purchasePrice)),
        0
      ),
    0
  );

  // Marge par ligne de vente — même calcul que `margeEstimee` ci-dessus,
  // réutilisé ici pour la décliner par boutique et par produit (section
  // "Produits les plus rentables" / colonne Marge, réservées au Super
  // Admin — voir page.tsx et export/route.ts).
  const lineMargin = (item: {
    quantity: number;
    unitPrice: unknown;
    discount: unknown;
    variant: { purchasePrice: unknown };
  }) =>
    item.quantity * Number(item.unitPrice) -
    Number(item.discount) -
    item.quantity * Number(item.variant.purchasePrice);

  const ventesParBoutique = new Map<
    string,
    { name: string; total: number; count: number; margin: number; delivery: number }
  >();
  for (const s of sales) {
    const entry = ventesParBoutique.get(s.boutiqueId) ?? {
      name: s.boutique.name,
      total: 0,
      count: 0,
      margin: 0,
      delivery: 0,
    };
    entry.total += Number(s.totalAmount);
    entry.count += 1;
    entry.margin += s.items.reduce((sum, item) => sum + lineMargin(item), 0);
    entry.delivery += Number(s.deliveryFee);
    ventesParBoutique.set(s.boutiqueId, entry);
  }

  const produitsVendus = new Map<
    string,
    { label: string; quantity: number; margin: number }
  >();
  for (const s of sales) {
    for (const item of s.items) {
      const entry = produitsVendus.get(item.variantId) ?? {
        label: variantLabel(item.variant.product, item.variant),
        quantity: 0,
        margin: 0,
      };
      entry.quantity += item.quantity;
      entry.margin += lineMargin(item);
      produitsVendus.set(item.variantId, entry);
    }
  }
  const topProduits = [...produitsVendus.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
  const topProduitsByMargin = [...produitsVendus.values()]
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 10);

  const depensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const achatsTotal = purchaseOrders.reduce(
    (sum, po) =>
      sum +
      po.items.reduce(
        (itemSum, item) => itemSum + item.quantityReceived * Number(item.unitCost),
        0
      ),
    0
  );

  const stockValue = stocks.reduce(
    (sum, s) => sum + s.quantity * Number(s.variant.purchasePrice),
    0
  );
  const stockFaible = stocks.filter(
    (s) => s.quantity > 0 && s.quantity <= s.variant.alertThreshold
  );
  const stockRupture = stocks.filter((s) => s.quantity <= 0);

  return {
    from,
    to,
    isSuperAdmin,
    isCaissier,
    isLogistique,
    showSales,
    showStock,
    showFinance,
    sales,
    caTotal,
    revenuLivraison,
    margeEstimee,
    ventesParBoutique: [...ventesParBoutique.values()],
    topProduits,
    topProduitsByMargin,
    depensesTotal,
    achatsTotal,
    stockValue,
    stockFaible,
    stockRupture,
  };
}
