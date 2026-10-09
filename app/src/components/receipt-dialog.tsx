"use client";

import { useRef, useState, type ReactNode } from "react";
import { Printer, Download, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Busy = "pdf" | "share" | null;

// Affiche un reçu/ticket (page dédiée hors layout, voir /recus/*) dans une
// popup via iframe plutôt que d'ouvrir un nouvel onglet. L'iframe pointe
// vers la même origine (juste une autre route Next.js), donc on peut lire
// son DOM directement — pas besoin de dupliquer le rendu du ticket ici
// pour le PDF/le partage, on capture l'élément [data-receipt-card] déjà
// affiché dedans.
export function ReceiptDialog({
  url,
  fileNameBase,
  triggerRender,
  children,
  title = "Reçu",
}: {
  url: string;
  fileNameBase: string;
  triggerRender: React.ReactElement;
  children: ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [iframeHeight, setIframeHeight] = useState(480);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Le ticket s'affiche en popup à sa taille réelle plutôt que dans une
  // zone fixe (ce qui laissait un grand vide gris en dessous pour un
  // petit ticket) — on mesure le contenu une fois chargé.
  function handleIframeLoad() {
    const doc = iframeRef.current?.contentDocument;
    const height = doc?.documentElement?.scrollHeight;
    if (height) {
      setIframeHeight(Math.min(Math.max(height, 300), Math.round(window.innerHeight * 0.75)));
    }
  }

  async function captureCanvas() {
    const doc = iframeRef.current?.contentDocument;
    const el = doc?.querySelector<HTMLElement>("[data-receipt-card]");
    if (!el) {
      toast.error("Le ticket n'est pas encore chargé, réessayez.");
      return null;
    }
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
  }

  async function handleDownloadPdf() {
    setBusy("pdf");
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const widthMm = 80;
      const heightMm = (canvas.height / canvas.width) * widthMm;
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: [widthMm, heightMm] });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);
      doc.save(`${fileNameBase}.pdf`);
    } catch {
      toast.error("Impossible de générer le PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShareWhatsapp() {
    setBusy("share");
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        toast.error("Impossible de préparer l'image à partager.");
        return;
      }
      const file = new File([blob], `${fileNameBase}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Reçu DYNASTIE SHOP" });
        return;
      }
      // Partage de fichier non supporté par ce navigateur (courant sur
      // desktop) : on télécharge l'image et on ouvre WhatsApp à côté, à
      // joindre manuellement — pas de perte silencieuse de fonctionnalité.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${fileNameBase}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
      window.open("https://wa.me/", "_blank");
      toast.info("Image téléchargée, joignez-la dans la conversation WhatsApp.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast.error("Impossible de partager le reçu.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerRender}>{children}</DialogTrigger>
      <DialogContent className="max-w-sm gap-3 p-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              onClick={() => iframeRef.current?.contentWindow?.print()}
            >
              <Printer className="mr-1.5 size-3.5" />
              Imprimer
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={handleDownloadPdf}>
              {busy === "pdf" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 size-3.5" />
              )}
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
              onClick={handleShareWhatsapp}
            >
              {busy === "share" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Share2 className="mr-1.5 size-3.5" />
              )}
              WhatsApp
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto rounded-lg border bg-muted/30">
          {open && (
            <iframe
              ref={iframeRef}
              src={`${url}?embed=1`}
              title="Reçu"
              onLoad={handleIframeLoad}
              className="block w-full"
              style={{ border: 0, height: iframeHeight }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
