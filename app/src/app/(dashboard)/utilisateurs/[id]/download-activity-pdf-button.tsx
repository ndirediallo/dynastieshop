"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ActivityExportJson {
  userName: string;
  boutiqueName: string | null;
  periodLabel: string;
  query: string | null;
  logs: { date: string; action: string; details: string }[];
}

type Rgb = [number, number, number];

// Même palette que les autres PDF de l'app (rapports, historique des
// ventes, inventaire) — pour que tous les documents DYNASTIE SHOP se
// ressemblent.
const BRAND: Rgb = [224, 37, 122];
const INK: Rgb = [23, 23, 23];
const MUTED: Rgb = [113, 113, 122];
const BORDER: Rgb = [228, 228, 231];

const PAGE_WIDTH = 210;
const MARGIN = 14;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const datePart = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeStyle: "medium" }).format(d);
  return `${datePart} ${timePart}`;
}

export function DownloadActivityPdfButton({
  userId,
  q,
  from,
  to,
  periodLabel,
  company,
}: {
  userId: string;
  q?: string;
  from?: string;
  to?: string;
  periodLabel: string;
  company: { name: string; address: string | null; phone: string | null };
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await fetch(
        `/utilisateurs/${userId}/activity-export${qs ? `?${qs}` : ""}`
      );
      if (!res.ok) throw new Error("export failed");
      const data: ActivityExportJson = await res.json();

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
      doc.text("ACTIVITÉ UTILISATEUR", PAGE_WIDTH - MARGIN, 16, { align: "right" });

      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.text(data.userName, MARGIN, 45);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      const subLines = [
        data.boutiqueName,
        periodLabel,
        data.query ? `Recherche : « ${data.query} »` : null,
        `${data.logs.length} entrée${data.logs.length > 1 ? "s" : ""}`,
      ]
        .filter(Boolean)
        .join("  ·  ");
      doc.text(subLines, MARGIN, 52);

      autoTable(doc, {
        startY: 62,
        margin: { left: MARGIN, right: MARGIN, bottom: 20 },
        head: [["Date", "Action", "Détails"]],
        body: data.logs.map((l) => [formatDateTime(l.date), l.action, l.details]),
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: INK,
          lineColor: BORDER,
          lineWidth: 0.15,
          cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 },
        },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 38 },
        },
        headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
        didDrawPage: () => {
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.setDrawColor(...BORDER);
          doc.line(MARGIN, pageHeight - 15, PAGE_WIDTH - MARGIN, pageHeight - 15);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text(`${company.name} · Activité de ${data.userName}`, MARGIN, pageHeight - 10);
          doc.text(
            `Page ${doc.getCurrentPageInfo().pageNumber}`,
            PAGE_WIDTH - MARGIN,
            pageHeight - 10,
            { align: "right" }
          );
        },
      });

      doc.save(`activite-${data.userName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
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
