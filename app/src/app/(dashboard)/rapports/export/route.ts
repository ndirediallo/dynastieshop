import { NextRequest } from "next/server";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { getReportData, periodLabel, variantLabel } from "../report-data";

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

// Même format / mêmes données que ce qu'affiche /rapports pour ce rôle et
// cette période — y compris les restrictions (un Caissier n'exporte jamais
// la répartition par boutique ni le stock, exactement comme à l'écran).
export async function GET(request: NextRequest) {
  const user = await requirePageAccess("rapports");
  const settings = await getSettings();
  const period = request.nextUrl.searchParams.get("period") ?? "month";
  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;

  const data = await getReportData(period, user, { from, to });

  const clean = {
    period,
    periodLabel: periodLabel(data.from, data.to),
    isSuperAdmin: data.isSuperAdmin,
    isCaissier: data.isCaissier,
    showSales: data.showSales,
    showStock: data.showStock,
    showFinance: data.showFinance,
    salesCount: data.sales.length,
    caTotal: data.caTotal,
    revenuLivraison: data.revenuLivraison,
    topProduits: data.topProduits,
    depensesTotal: data.depensesTotal,
    achatsTotal: data.achatsTotal,
    stockValue: data.stockValue,
    stockFaible: data.stockFaible.map((s) => ({
      label: variantLabel(s.variant.product, s.variant),
      boutique: s.boutique.name,
      quantity: s.quantity,
    })),
    stockRupture: data.stockRupture.map((s) => ({
      label: variantLabel(s.variant.product, s.variant),
      boutique: s.boutique.name,
      quantity: s.quantity,
    })),
    // La marge (globale, par boutique, par produit) ne doit jamais
    // atteindre un non-Super Admin, même dans la réponse JSON brute
    // (?format=json) — avant ce correctif, ces champs étaient toujours
    // présents dans `clean` et seul l'affichage CSV les cachait : quelqu'un
    // appelant directement l'URL avec format=json aurait quand même pu les
    // lire. Voir la même règle déjà appliquée à l'écran et sur le PDF.
    ...(data.isSuperAdmin
      ? {
          margeEstimee: data.margeEstimee,
          ventesParBoutique: data.ventesParBoutique,
          topProduitsByMargin: data.topProduitsByMargin,
        }
      : {}),
  };

  if (request.nextUrl.searchParams.get("format") === "json") {
    return Response.json(clean);
  }

  const currency = settings.currency;
  const lines: string[] = [];
  lines.push(csvEscape(`Rapport · ${clean.periodLabel}`));
  lines.push("");

  if (clean.showSales) {
    lines.push(csvEscape("Résumé des ventes"));
    lines.push(["Chiffre d'affaires", "Nombre de ventes", "Revenus livraison"].map(csvEscape).join(";"));
    lines.push(
      [`${clean.caTotal} ${currency}`, String(clean.salesCount), `${clean.revenuLivraison} ${currency}`]
        .map(csvEscape)
        .join(";")
    );
    lines.push("");

    if (clean.isSuperAdmin) {
      lines.push(csvEscape("Ventes par boutique"));
      lines.push(["Boutique", "Ventes", "Total", "Livraison", "Marge"].map(csvEscape).join(";"));
      for (const v of clean.ventesParBoutique!) {
        lines.push(
          [
            v.name,
            String(v.count),
            `${v.total} ${currency}`,
            `${v.delivery} ${currency}`,
            `${v.margin} ${currency}`,
          ]
            .map(csvEscape)
            .join(";")
        );
      }
      lines.push("");
    }

    lines.push(csvEscape("Produits les plus vendus"));
    lines.push(["Produit", "Quantité vendue"].map(csvEscape).join(";"));
    for (const p of clean.topProduits) {
      lines.push([p.label, String(p.quantity)].map(csvEscape).join(";"));
    }
    lines.push("");

    if (clean.isSuperAdmin) {
      lines.push(csvEscape("Produits les plus rentables"));
      lines.push(["Produit", "Marge"].map(csvEscape).join(";"));
      for (const p of clean.topProduitsByMargin!) {
        lines.push([p.label, `${p.margin} ${currency}`].map(csvEscape).join(";"));
      }
      lines.push("");
    }
  }

  if (clean.showStock) {
    lines.push(csvEscape("Stock"));
    lines.push(["Valeur du stock (au coût)", "Achats reçus (période)"].map(csvEscape).join(";"));
    lines.push(
      [`${clean.stockValue} ${currency}`, `${clean.achatsTotal} ${currency}`]
        .map(csvEscape)
        .join(";")
    );
    lines.push("");

    lines.push(csvEscape("Stock faible et ruptures"));
    lines.push(["Produit", "Boutique", "Quantité", "Statut"].map(csvEscape).join(";"));
    for (const s of clean.stockRupture) {
      lines.push([s.label, s.boutique, String(s.quantity), "Rupture"].map(csvEscape).join(";"));
    }
    for (const s of clean.stockFaible) {
      lines.push(
        [s.label, s.boutique, String(s.quantity), "Stock faible"].map(csvEscape).join(";")
      );
    }
    lines.push("");
  }

  if (clean.showFinance) {
    lines.push(csvEscape("Finances"));
    lines.push(["Marge estimée", "Dépenses"].map(csvEscape).join(";"));
    lines.push(
      [`${clean.margeEstimee!} ${currency}`, `${clean.depensesTotal} ${currency}`]
        .map(csvEscape)
        .join(";")
    );
  }

  const csv = lines.join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rapport-${date}.csv"`,
    },
  });
}
