"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPdfAmount } from "@/lib/pdf-format";

interface ReportJson {
  periodLabel: string;
  isSuperAdmin: boolean;
  showSales: boolean;
  showStock: boolean;
  showFinance: boolean;
  salesCount: number;
  caTotal: number;
  revenuLivraison: number;
  // Présents uniquement quand isSuperAdmin est vrai (voir export/route.ts) —
  // chaque usage ci-dessous reste dans un bloc déjà gardé par cette même
  // condition.
  margeEstimee?: number;
  ventesParBoutique?: { name: string; count: number; total: number; margin: number; delivery: number }[];
  topProduitsByMargin?: { label: string; margin: number }[];
  topProduits: { label: string; quantity: number }[];
  depensesTotal: number;
  achatsTotal: number;
  stockValue: number;
  stockFaible: { label: string; boutique: string; quantity: number }[];
  stockRupture: { label: string; boutique: string; quantity: number }[];
}

type Rgb = [number, number, number];

// Même palette que les autres PDF de l'app (historique des ventes,
// inventaire) — pour que tous les documents DYNASTIE SHOP se ressemblent.
const BRAND: Rgb = [224, 37, 122];
const INK: Rgb = [23, 23, 23];
const BORDER: Rgb = [228, 228, 231];
const PANEL_BG: Rgb = [248, 246, 247];

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export function DownloadReportPdfButton({
  period,
  from,
  to,
  currency,
  company,
}: {
  period: string;
  from?: string;
  to?: string;
  currency: string;
  company: { name: string; address: string | null; phone: string | null };
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ format: "json", period });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/rapports/export?${params.toString()}`);
      if (!res.ok) throw new Error("export failed");
      const data: ReportJson = await res.json();
      const fmt = (n: number) => `${formatPdfAmount(n)} ${currency}`;

      const doc = new jsPDF();

      doc.setFillColor(...BRAND);
      doc.rect(0, 0, PAGE_WIDTH, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(company.name, MARGIN, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const contactLine = [company.address, company.phone].filter(Boolean).join("   ·   ");
      if (contactLine) doc.text(contactLine, MARGIN, 23);
      doc.setFontSize(8.5);
      doc.text("RAPPORT", PAGE_WIDTH - MARGIN, 16, { align: "right" });

      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.text(data.periodLabel, MARGIN, 45);

      let y = 60;
      const boxWidth = (CONTENT_WIDTH - 6) / 2;
      const drawStatBox = (x: number, by: number, label: string, value: string) => {
        doc.setFillColor(...PANEL_BG);
        doc.roundedRect(x, by, boxWidth, 19, 2.5, 2.5, "F");
        doc.setTextColor(...INK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(label.toUpperCase(), x + 7, by + 7.5);
        doc.setFontSize(13);
        doc.text(value, x + 7, by + 15.5);
      };

      if (data.showSales) {
        drawStatBox(MARGIN, y, "Chiffre d'affaires", fmt(data.caTotal));
        drawStatBox(MARGIN + boxWidth + 6, y, "Ventes", String(data.salesCount));
        y += 25;
        drawStatBox(MARGIN, y, "Revenus livraison", fmt(data.revenuLivraison));
        if (data.isSuperAdmin) {
          drawStatBox(MARGIN + boxWidth + 6, y, "Marge estimée", fmt(data.margeEstimee!));
        }
        y += 25;
        if (data.showFinance) {
          drawStatBox(MARGIN, y, "Dépenses", fmt(data.depensesTotal));
          y += 25;
        }
      }

      const addTable = (title: string, head: string[], body: (string | number)[][]) => {
        if (body.length === 0) return;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...INK);
        doc.text(title, MARGIN, y);
        autoTable(doc, {
          startY: y + 3,
          margin: { left: MARGIN, right: MARGIN, bottom: 20 },
          head: [head],
          body,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8.5,
            textColor: INK,
            lineColor: BORDER,
            lineWidth: 0.15,
            cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
          },
          headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
        });
        // @ts-expect-error — lastAutoTable est injecté par le plugin autoTable
        y = doc.lastAutoTable.finalY + 12;
      };

      if (data.showSales && data.isSuperAdmin) {
        addTable(
          "Ventes par boutique",
          ["Boutique", "Ventes", "Total", "Livraison", "Marge"],
          data.ventesParBoutique!.map((v) => [
            v.name,
            v.count,
            fmt(v.total),
            fmt(v.delivery),
            fmt(v.margin),
          ])
        );
      }

      if (data.showSales) {
        addTable(
          "Produits les plus vendus",
          ["Produit", "Quantité vendue"],
          data.topProduits.map((p) => [p.label, p.quantity])
        );
      }

      if (data.showSales && data.isSuperAdmin) {
        addTable(
          "Produits les plus rentables",
          ["Produit", "Marge"],
          data.topProduitsByMargin!.map((p) => [p.label, fmt(p.margin)])
        );
      }

      if (data.showStock) {
        drawStatBox(MARGIN, y, "Valeur du stock (au coût)", fmt(data.stockValue));
        drawStatBox(MARGIN + boxWidth + 6, y, "Achats reçus (période)", fmt(data.achatsTotal));
        y += 25;
        addTable(
          `Stock faible (${data.stockFaible.length}) et ruptures (${data.stockRupture.length})`,
          ["Produit", "Boutique", "Quantité"],
          [...data.stockRupture, ...data.stockFaible].map((s) => [
            s.label,
            s.boutique,
            s.quantity,
          ])
        );
      }

      doc.save(`rapport-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      toast.error("Impossible de générer le PDF. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={loading}
      size="sm"
      className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400"
    >
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Download className="mr-2 size-4" />
      )}
      {loading ? "Génération..." : "Exporter (PDF)"}
    </Button>
  );
}
