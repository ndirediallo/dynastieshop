"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { GuideTopic } from "@/lib/guide-content";

type Rgb = [number, number, number];

// Même palette que les autres PDF de l'app (reçus, rapports) — pour que ce
// guide ait l'air de faire partie de DYNASTIE SHOP, pas d'un document à part.
const BRAND: Rgb = [224, 37, 122];
const INK: Rgb = [23, 23, 23];
const MUTED: Rgb = [113, 113, 122];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Charge une image publique (capture d'écran) en data URL exploitable par
// jsPDF (doc.addImage n'accepte pas une simple URL distante) — et renvoie
// ses dimensions réelles pour calculer une hauteur proportionnelle une fois
// mise à l'échelle de la largeur de page.
async function loadImage(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
  return { dataUrl, width, height };
}

export function DownloadGuidePdfButton({
  moduleLabel,
  topics,
  company,
}: {
  moduleLabel: string;
  topics: GuideTopic[];
  company: { name: string; logoUrl: string | null };
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const doc = new jsPDF();

      doc.setFillColor(...BRAND);
      doc.rect(0, 0, PAGE_WIDTH, 26, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(company.name, MARGIN, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Guide d'utilisation · ${moduleLabel}`, MARGIN, 21);

      let y = 38;
      const ensureSpace = (needed: number) => {
        if (y + needed > PAGE_HEIGHT - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
      };

      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];
        ensureSpace(20);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...INK);
        doc.text(`${i + 1}. ${topic.title}`, MARGIN, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        for (const step of topic.steps) {
          const lines: string[] = doc.splitTextToSize(`•  ${step}`, CONTENT_WIDTH);
          ensureSpace(lines.length * 5 + 2);
          doc.text(lines, MARGIN, y);
          y += lines.length * 5 + 2;
        }

        try {
          const { dataUrl, width, height } = await loadImage(topic.screenshot);
          const imgWidth = CONTENT_WIDTH;
          const imgHeight = (height / width) * imgWidth;
          ensureSpace(imgHeight + 10);
          y += 3;
          doc.setDrawColor(228, 228, 231);
          doc.rect(MARGIN, y, imgWidth, imgHeight);
          doc.addImage(dataUrl, "PNG", MARGIN, y, imgWidth, imgHeight);
          y += imgHeight + 12;
        } catch {
          // Capture indisponible : le PDF reste utile avec le texte seul.
          y += 4;
        }
      }

      doc.save(`guide-${moduleLabel.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch {
      toast.error("Impossible de générer le PDF. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleDownload} disabled={loading} variant="outline">
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Download className="mr-2 size-4" />
      )}
      {loading ? "Génération..." : "Télécharger (PDF)"}
    </Button>
  );
}
