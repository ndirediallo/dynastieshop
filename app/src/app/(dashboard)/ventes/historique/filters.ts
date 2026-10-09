import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const PERIOD_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
] as const;
export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

export const STATUS_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "retour", label: "Avec retour" },
  { value: "credit_ouvert", label: "Crédit en cours" },
  { value: "credit_solde", label: "Crédit soldé" },
] as const;
export type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

export const PAGE_SIZE = 50;

// Garde-fou technique, pas une limite métier : aucune vente n'est jamais
// retirée de l'historique (exigence comptabilité/vérification — la
// boutique veut pouvoir retrouver n'importe quelle vente passée). Ce
// plafond très haut évite juste un fetch illimité en cas de volumétrie
// extrême ; en usage normal il n'est jamais atteint, contrairement à
// l'ancien `take: 200` qui faisait silencieusement disparaître les ventes
// les plus anciennes.
const FETCH_CAP = 5000;

export const SORT_OPTIONS = ["date", "total"] as const;
export type SortByValue = (typeof SORT_OPTIONS)[number];
export type SortDirValue = "asc" | "desc";

export interface SaleHistoryFilters {
  period: PeriodValue;
  // Plage personnalisée (YYYY-MM-DD, bornes incluses) — quand l'une des
  // deux est renseignée, elle prend le pas sur `period` (voir
  // getDateRange ci-dessous). Permet par exemple "les 3 derniers jours",
  // qu'aucun préréglage ne couvre exactement.
  from?: string;
  to?: string;
  boutiqueId?: string;
  userId?: string;
  status: StatusValue;
  // Recherche libre sur la référence du ticket ou le nom du client.
  search?: string;
  sortBy: SortByValue;
  sortDir: SortDirValue;
  page: number;
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function isValidDateStr(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseFilters(
  sp: Record<string, string | string[] | undefined>
): SaleHistoryFilters {
  const periodRaw = one(sp.period);
  const statusRaw = one(sp.status);
  const period = PERIOD_OPTIONS.some((p) => p.value === periodRaw)
    ? (periodRaw as PeriodValue)
    : "all";
  const status = STATUS_OPTIONS.some((s) => s.value === statusRaw)
    ? (statusRaw as StatusValue)
    : "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const fromRaw = one(sp.from);
  const toRaw = one(sp.to);
  const sortByRaw = one(sp.sortBy);
  const sortBy = SORT_OPTIONS.includes(sortByRaw as SortByValue)
    ? (sortByRaw as SortByValue)
    : "date";
  const sortDir: SortDirValue = one(sp.sortDir) === "asc" ? "asc" : "desc";
  const search = one(sp.search)?.trim() || undefined;
  return {
    period,
    status,
    page,
    boutiqueId: one(sp.boutiqueId) || undefined,
    userId: one(sp.userId) || undefined,
    from: isValidDateStr(fromRaw) ? fromRaw : undefined,
    to: isValidDateStr(toRaw) ? toRaw : undefined,
    search,
    sortBy,
    sortDir,
  };
}

function getFromDate(period: PeriodValue): Date | undefined {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:
      return undefined;
  }
}

// Une plage personnalisée (from/to) prend toujours le pas sur les
// préréglages de période — elle couvre des cas que les pastilles ne
// couvrent pas exactement (ex. "les 3 derniers jours").
function getDateRange(filters: SaleHistoryFilters): { gte?: Date; lte?: Date } {
  if (filters.from || filters.to) {
    return {
      gte: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
      lte: filters.to ? new Date(`${filters.to}T23:59:59.999`) : undefined,
    };
  }
  return { gte: getFromDate(filters.period) };
}

export interface SaleHistoryRow {
  id: string;
  reference: string;
  createdAt: Date;
  boutiqueName: string;
  customerName: string;
  caissierName: string;
  totalAmount: number;
  discount: number;
  isCredit: boolean;
  paid: number;
  balance: number;
  returnedAmount: number;
  hasReturn: boolean;
  paymentMethods: string[];
}

function matchesStatus(row: SaleHistoryRow, status: StatusValue) {
  switch (status) {
    case "retour":
      return row.hasReturn;
    case "credit_ouvert":
      return row.isCredit && row.balance > 0.01;
    case "credit_solde":
      return row.isCredit && row.balance <= 0.01;
    case "all":
    default:
      return true;
  }
}

// "04/10/2026 à 12:10" — le "à" explicite sépare visuellement la date de
// l'heure, plus lisible qu'un simple espace entre les deux groupes de
// chiffres.
export function formatSaleDateTime(date: Date): string {
  const datePart = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(date);
  return `${datePart} à ${timePart}`;
}

export function statusLabel(row: SaleHistoryRow): string {
  if (row.hasReturn) return "Retour(s)";
  if (row.isCredit && row.balance > 0.01) return "Crédit en cours";
  if (row.isCredit) return "Crédit soldé";
  return "Validée";
}

// Point d'entrée unique, partagé par la page (paginée en mémoire) et
// l'export CSV (non paginé) — les deux doivent filtrer exactement de la
// même façon, calculée une seule fois ici pour ne jamais diverger.
export async function getFilteredSaleRows(
  filters: SaleHistoryFilters,
  user: { id: string; role: string; boutiqueId?: string | null }
): Promise<SaleHistoryRow[]> {
  const where: Prisma.SaleWhereInput = {};
  const { gte, lte } = getDateRange(filters);
  if (gte || lte) where.createdAt = { ...(gte && { gte }), ...(lte && { lte }) };

  // Un Super Admin peut filtrer par boutique et par caissier. Un Caissier
  // voit toutes les ventes de SA boutique (même équipe), pas seulement les
  // siennes — cohérent avec le tableau de bord et Produits (voir aussi
  // sale.boutiqueId sur /ventes/[id]).
  if (user.role === "SUPER_ADMIN") {
    if (filters.boutiqueId) where.boutiqueId = filters.boutiqueId;
    if (filters.userId) where.userId = filters.userId;
  } else if (user.boutiqueId) {
    where.boutiqueId = user.boutiqueId;
  } else {
    where.userId = user.id;
  }

  if (filters.search) {
    where.OR = [
      { reference: { contains: filters.search, mode: "insensitive" } },
      { customer: { name: { contains: filters.search, mode: "insensitive" } } },
      { customer: { phone: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      boutique: { select: { name: true } },
      customer: { select: { name: true } },
      user: { select: { name: true } },
      payments: { select: { amount: true, method: true } },
      returns: { select: { refundAmount: true } },
    },
    orderBy: { createdAt: "desc" },
    take: FETCH_CAP,
  });

  const rows: SaleHistoryRow[] = sales.map((sale) => {
    const paid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = sale.isCredit
      ? Math.round((Number(sale.totalAmount) - paid) * 100) / 100
      : 0;
    const returnedAmount = sale.returns.reduce(
      (sum, r) => sum + Number(r.refundAmount),
      0
    );
    return {
      id: sale.id,
      reference: sale.reference,
      createdAt: sale.createdAt,
      boutiqueName: sale.boutique.name,
      customerName: sale.customer?.name ?? "Client de passage",
      caissierName: sale.user.name,
      totalAmount: Number(sale.totalAmount),
      discount: Number(sale.discount),
      isCredit: sale.isCredit,
      paid,
      balance,
      returnedAmount,
      hasReturn: sale.returns.length > 0,
      paymentMethods: [...new Set(sale.payments.map((p) => p.method))],
    };
  });

  const filtered = rows.filter((r) => matchesStatus(r, filters.status));

  filtered.sort((a, b) => {
    const cmp =
      filters.sortBy === "total"
        ? a.totalAmount - b.totalAmount
        : a.createdAt.getTime() - b.createdAt.getTime();
    return filters.sortDir === "asc" ? cmp : -cmp;
  });

  return filtered;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Mobile Money",
  WAVE: "Wave",
  CARTE: "Carte",
  VIREMENT: "Virement",
};

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

// Séparateur point-virgule : c'est ce qu'Excel en français attend par
// défaut pour découper les colonnes d'un CSV sans configuration manuelle.
export function rowsToCsv(rows: SaleHistoryRow[], currency: string): string {
  const header = [
    "Référence",
    "Date",
    "Boutique",
    "Client",
    "Caissier",
    "Sous-total",
    "Remise",
    "Total",
    `Devise`,
    "Moyens de paiement",
    "Statut",
    "Montant retourné",
    "Solde crédit dû",
  ];
  const lines = [header.map(csvEscape).join(";")];
  for (const r of rows) {
    const subtotal = r.totalAmount + r.discount;
    lines.push(
      [
        r.reference,
        formatSaleDateTime(r.createdAt),
        r.boutiqueName,
        r.customerName,
        r.caissierName,
        subtotal.toFixed(2),
        r.discount.toFixed(2),
        r.totalAmount.toFixed(2),
        currency,
        r.paymentMethods.map((m) => PAYMENT_METHOD_LABELS[m] ?? m).join(" + "),
        statusLabel(r),
        r.returnedAmount.toFixed(2),
        r.isCredit ? r.balance.toFixed(2) : "",
      ]
        .map((v) => csvEscape(String(v)))
        .join(";")
    );
  }
  // BOM UTF-8 pour qu'Excel affiche correctement les accents à l'ouverture.
  return "﻿" + lines.join("\r\n");
}
