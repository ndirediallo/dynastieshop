"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatPdfAmount } from "@/lib/pdf-format";

interface PdfRow {
  reference: string;
  createdAt: string;
  boutiqueName: string;
  customerName: string;
  caissierName: string;
  totalAmount: number;
  returnedAmount: number;
  isCredit: boolean;
  balance: number;
  hasReturn: boolean;
}

type Rgb = [number, number, number];

// Même palette que le PDF d'inventaire (download-pdf-button.tsx) — pour que
// tous les documents DYNASTIE SHOP se ressemblent, pas une page par page.
const BRAND: Rgb = [224, 37, 122];
const INK: Rgb = [23, 23, 23];
const MUTED: Rgb = [113, 113, 122];
const BORDER: Rgb = [228, 228, 231];
const PANEL_BG: Rgb = [248, 246, 247];
const DESTRUCTIVE_BG: Rgb = [254, 226, 226];
const DESTRUCTIVE_TEXT: Rgb = [185, 28, 28];
const SUCCESS_TEXT: Rgb = [4, 120, 87];

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatSaleDateTime(date: Date): string {
  const datePart = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(date);
  return `${datePart} à ${timePart}`;
}

function statusLabel(row: PdfRow): string {
  if (row.hasReturn) return "Retour(s)";
  if (row.isCredit && row.balance > 0.01) return "Crédit en cours";
  if (row.isCredit) return "Crédit soldé";
  return "Validée";
}

export function DownloadHistoryPdfButton({
  queryString,
  filterSummary,
  currency,
  company,
}: {
  queryString: string;
  filterSummary: string;
  currency: string;
  company: { name: string; address: string | null; phone: string | null };
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(
        `/ventes/historique/export?format=json${queryString ? `&${queryString}` : ""}`
      );
      if (!res.ok) throw new Error("export failed");
      const rows: PdfRow[] = await res.json();

      const caTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);
      const returnedTotal = rows.reduce((sum, r) => sum + r.returnedAmount, 0);
      const creditDueTotal = rows.reduce(
        (sum, r) => sum + (r.isCredit && r.balance > 0.01 ? r.balance : 0),
        0
      );
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
      doc.text("HISTORIQUE DES VENTES", PAGE_WIDTH - MARGIN, 16, { align: "right" });

      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.text(`${rows.length} vente${rows.length > 1 ? "s" : ""}`, MARGIN, 45);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text(filterSummary, MARGIN, 52);

      const statsY = 60;
      const boxWidth = (CONTENT_WIDTH - 6) / 2;
      const drawStatBox = (
        x: number,
        y: number,
        label: string,
        value: string,
        bg: Rgb,
        textColor: Rgb
      ) => {
        doc.setFillColor(...bg);
        doc.roundedRect(x, y, boxWidth, 19, 2.5, 2.5, "F");
        doc.setTextColor(...textColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(label.toUpperCase(), x + 7, y + 7.5);
        doc.setFontSize(13);
        doc.text(value, x + 7, y + 15.5);
      };
      drawStatBox(MARGIN, statsY, "Chiffre d'affaires", fmt(caTotal), PANEL_BG, INK);
      drawStatBox(
        MARGIN + boxWidth + 6,
        statsY,
        "Retourné",
        fmt(returnedTotal),
        returnedTotal > 0 ? DESTRUCTIVE_BG : PANEL_BG,
        returnedTotal > 0 ? DESTRUCTIVE_TEXT : INK
      );
      drawStatBox(
        MARGIN,
        statsY + 23,
        "Crédit en cours",
        fmt(creditDueTotal),
        creditDueTotal > 0 ? DESTRUCTIVE_BG : PANEL_BG,
        creditDueTotal > 0 ? DESTRUCTIVE_TEXT : INK
      );
      drawStatBox(
        MARGIN + boxWidth + 6,
        statsY + 23,
        "Ventes",
        String(rows.length),
        PANEL_BG,
        INK
      );

      autoTable(doc, {
        startY: statsY + 50,
        margin: { left: MARGIN, right: MARGIN, bottom: 20 },
        head: [["Référence", "Date", "Boutique", "Client", "Caissier", "Total", "Statut"]],
        body: rows.map((r) => [
          r.reference,
          formatSaleDateTime(new Date(r.createdAt)),
          r.boutiqueName,
          r.customerName,
          r.caissierName,
          fmt(r.totalAmount),
          statusLabel(r),
        ]),
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
        columnStyles: {
          5: { halign: "right", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            const label = String(data.cell.raw);
            if (label === "Retour(s)" || label === "Crédit en cours") {
              data.cell.styles.textColor = DESTRUCTIVE_TEXT;
            } else if (label === "Validée") {
              data.cell.styles.textColor = SUCCESS_TEXT;
            } else {
              data.cell.styles.textColor = MUTED;
            }
          }
        },
        didDrawPage: () => {
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setDrawColor(...BORDER);
          doc.line(MARGIN, pageHeight - 15, PAGE_WIDTH - MARGIN, pageHeight - 15);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(`${company.name} · Historique des ventes`, MARGIN, pageHeight - 10);
          doc.text(
            `Page ${doc.getCurrentPageInfo().pageNumber}`,
            PAGE_WIDTH - MARGIN,
            pageHeight - 10,
            { align: "right" }
          );
        },
      });

      doc.save(`historique-ventes-${new Date().toISOString().slice(0, 10)}.pdf`);
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
