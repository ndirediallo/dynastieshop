"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfLine {
  label: string;
  theoreticalQuantity: number;
  countedQuantity: number;
  delta: number;
}

type Rgb = [number, number, number];

// Palette alignée sur les tokens de l'app (--primary, couleurs sémantiques
// ambre/émeraude/rouge déjà utilisées dans l'UI) pour que le PDF ressemble
// à un vrai document DYNASTIE SHOP plutôt qu'à une sortie jsPDF générique.
const BRAND: Rgb = [224, 37, 122];
const INK: Rgb = [23, 23, 23];
const MUTED: Rgb = [113, 113, 122];
const BORDER: Rgb = [228, 228, 231];
const PANEL_BG: Rgb = [248, 246, 247];
const AMBER_BG: Rgb = [254, 243, 199];
const AMBER_TEXT: Rgb = [146, 64, 14];
const SUCCESS_BG: Rgb = [209, 250, 229];
const SUCCESS_TEXT: Rgb = [4, 120, 87];
const DESTRUCTIVE_TEXT: Rgb = [185, 28, 28];

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export function DownloadPdfButton({
  session,
  lines,
  company,
}: {
  session: {
    reference: string;
    boutiqueName: string;
    userName: string;
    createdAt: string;
  };
  lines: PdfLine[];
  company: { name: string; address: string | null; phone: string | null };
}) {
  const handleDownload = () => {
    const doc = new jsPDF();
    const changeCount = lines.filter((l) => l.delta !== 0).length;
    const formattedDate = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(session.createdAt));

    // --- Bandeau de marque ---
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
    doc.text("FICHE D'INVENTAIRE", PAGE_WIDTH - MARGIN, 16, { align: "right" });

    // --- Titre + pastille d'écart ---
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(`Inventaire ${session.reference}`, MARGIN, 45);

    const pillLabel =
      changeCount > 0 ? `${changeCount} ÉCART${changeCount > 1 ? "S" : ""}` : "AUCUN ÉCART";
    const [pillBg, pillText] = changeCount > 0 ? [AMBER_BG, AMBER_TEXT] : [SUCCESS_BG, SUCCESS_TEXT];
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const pillWidth = doc.getTextWidth(pillLabel) + 11;
    const pillX = PAGE_WIDTH - MARGIN - pillWidth;
    doc.setFillColor(...pillBg);
    doc.roundedRect(pillX, 38, pillWidth, 8.5, 4.25, 4.25, "F");
    doc.setTextColor(...pillText);
    doc.text(pillLabel, pillX + pillWidth / 2, 43.8, { align: "center" });

    // --- Métadonnées (3 colonnes) ---
    const metaY = 56;
    const metaCols = [
      { label: "EMPLACEMENT", value: session.boutiqueName },
      { label: "COMPTÉ PAR", value: session.userName },
      { label: "DATE", value: formattedDate },
    ];
    const colWidth = CONTENT_WIDTH / 3;
    metaCols.forEach((col, i) => {
      const x = MARGIN + i * colWidth;
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(col.label, x, metaY);
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.text(col.value, x, metaY + 6);
    });

    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, metaY + 12, PAGE_WIDTH - MARGIN, metaY + 12);

    // --- Cartes de synthèse ---
    const statsY = metaY + 20;
    const statBoxWidth = (CONTENT_WIDTH - 6) / 2;
    const drawStatBox = (x: number, label: string, value: string, bg: Rgb, textColor: Rgb) => {
      doc.setFillColor(...bg);
      doc.roundedRect(x, statsY, statBoxWidth, 19, 2.5, 2.5, "F");
      doc.setTextColor(...textColor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(label.toUpperCase(), x + 7, statsY + 7.5);
      doc.setFontSize(16);
      doc.text(value, x + 7, statsY + 15.5);
    };
    drawStatBox(MARGIN, "Produits comptés", String(lines.length), PANEL_BG, INK);
    drawStatBox(
      MARGIN + statBoxWidth + 6,
      "Écarts détectés",
      String(changeCount),
      changeCount > 0 ? AMBER_BG : SUCCESS_BG,
      changeCount > 0 ? AMBER_TEXT : SUCCESS_TEXT
    );

    // --- Tableau du comptage ---
    autoTable(doc, {
      startY: statsY + 27,
      margin: { left: MARGIN, right: MARGIN, bottom: 20 },
      head: [["Produit", "Théorique", "Compté", "Écart"]],
      body: lines.map((l) => [
        l.label,
        String(l.theoreticalQuantity),
        String(l.countedQuantity),
        l.delta > 0 ? `+${l.delta}` : String(l.delta),
      ]),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        textColor: INK,
        lineColor: BORDER,
        lineWidth: 0.15,
        cellPadding: { top: 3.2, bottom: 3.2, left: 4, right: 4 },
      },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "right", textColor: MUTED },
        2: { halign: "right", fontStyle: "bold" },
        3: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        // `columnStyles` dans jspdf-autotable ne s'applique qu'au corps du
        // tableau, jamais à l'en-tête (comportement de la librairie) — sans
        // ceci, les titres de colonnes numériques restent alignés à gauche
        // alors que les valeurs sont à droite, et tout paraît désaligné.
        if (data.section === "head" && data.column.index > 0) {
          data.cell.styles.halign = "right";
        }
        if (data.section === "body" && data.column.index === 3) {
          const value = Number(data.cell.raw);
          if (value > 0) data.cell.styles.textColor = AMBER_TEXT;
          else if (value < 0) data.cell.styles.textColor = DESTRUCTIVE_TEXT;
          else data.cell.styles.textColor = MUTED;
        }
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...BORDER);
        doc.line(MARGIN, pageHeight - 15, PAGE_WIDTH - MARGIN, pageHeight - 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(`${company.name} · Inventaire ${session.reference}`, MARGIN, pageHeight - 10);
        doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, PAGE_WIDTH - MARGIN, pageHeight - 10, {
          align: "right",
        });
      },
    });

    doc.save(`inventaire-${session.reference}.pdf`);
  };

  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="mr-2 size-4" />
      Télécharger le PDF
    </Button>
  );
}
