import { NextRequest } from "next/server";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { parseFilters, getFilteredSaleRows, rowsToCsv } from "../filters";

// Exporte exactement le jeu de ventes affiché par la page (mêmes filtres),
// mais sans la pagination — c'est le rapport complet, pas juste la page
// visible à l'écran.
export async function GET(request: NextRequest) {
  const user = await requirePageAccess("ventes");
  const settings = await getSettings();

  const sp: Record<string, string | undefined> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    sp[key] = value;
  }
  const filters = parseFilters(sp);

  const rows = await getFilteredSaleRows(filters, user);

  // Variante JSON : utilisée par le bouton d'export PDF, qui génère le
  // document côté navigateur (jsPDF) — il a besoin des lignes brutes, pas
  // d'un fichier déjà formaté. Même filtrage que le CSV, juste une autre
  // sérialisation.
  if (request.nextUrl.searchParams.get("format") === "json") {
    return Response.json(rows);
  }

  const csv = rowsToCsv(rows, settings.currency);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historique-ventes-${date}.csv"`,
    },
  });
}
