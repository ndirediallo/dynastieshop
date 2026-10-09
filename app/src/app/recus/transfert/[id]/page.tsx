import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "../../print-button";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

// Document interne à joindre à la marchandise pendant le transport entre
// l'entrepôt et une boutique — même système que les reçus de vente
// (popup + imprimer + PDF + partage, voir ReceiptDialog), mais ce n'est
// pas un document client : pas de total en GNF, juste la liste des
// articles et la traçabilité (créé par / confirmé par / annulé, motif).
export default async function TransfertReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  await requirePageAccess("transferts");
  const { id } = await params;
  const { embed } = await searchParams;
  const settings = await getSettings();

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromBoutique: { select: { name: true } },
      toBoutique: { select: { name: true } },
      user: { select: { name: true } },
      validatedBy: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      items: {
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!transfer) notFound();

  const totalQty = transfer.items.reduce((sum, item) => sum + item.quantity, 0);
  const dateFmt = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(d);

  return (
    <div
      className={`bg-[#f4f4f5] text-black print:bg-white print:py-0 ${embed ? "py-4" : "min-h-screen py-8"}`}
    >
      <style>{`
        html, body { background: #f4f4f5; color: #000; }
        [data-receipt-card] { background-color: #fff !important; color: #000 !important; border-color: rgba(0,0,0,0.12) !important; }
        [data-receipt-card] * { border-color: rgba(0,0,0,0.3) !important; }
        [data-receipt-card] [class*="text-black/60"] { color: rgba(0,0,0,0.6) !important; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
        }
      `}</style>

      <div className="mx-auto max-w-[80mm] px-4 print:px-0">
        {!embed && (
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link
              href={`/transferts/${transfer.id}`}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="size-4" />
              Retour
            </Link>
            <PrintButton />
          </div>
        )}

        <div
          data-receipt-card
          className="rounded-lg border border-black/10 bg-white text-black p-4 font-mono text-[11px] leading-relaxed print:rounded-none print:border-none print:p-0"
        >
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wide">{settings.companyName}</p>
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p>{settings.phone}</p>}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-center text-xs font-bold uppercase tracking-wide">
            Bon de transfert
          </p>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span>Référence</span>
              <span className="font-semibold">{transfer.reference}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Date</span>
              <span>{dateFmt(transfer.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Origine</span>
              <span className="text-right">{transfer.fromBoutique.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Destination</span>
              <span className="text-right">{transfer.toBoutique.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Créé par</span>
              <span className="text-right">{transfer.user?.name ?? "—"}</span>
            </div>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-[10px] font-bold uppercase tracking-wide">Articles</p>
          <div className="mt-1 space-y-1">
            {transfer.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-2">
                <span>{variantLabel(item.variant.product, item.variant)}</span>
                <span className="font-semibold">{item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="flex justify-between gap-2 text-sm font-bold">
            <span>Total</span>
            <span className="font-figures tabular-nums">
              {totalQty} article{totalQty > 1 ? "s" : ""}
            </span>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          {transfer.status === "EN_ATTENTE" && (
            <p className="text-center text-[10px] font-bold uppercase tracking-wide">
              En attente de réception
            </p>
          )}
          {transfer.status === "VALIDE" && (
            <>
              <p className="text-center text-[10px] font-bold uppercase tracking-wide">
                Réception confirmée
              </p>
              {transfer.validatedAt && (
                <p className="text-center text-black/60">
                  {dateFmt(transfer.validatedAt)}
                  {transfer.validatedBy ? ` · ${transfer.validatedBy.name}` : ""}
                </p>
              )}
            </>
          )}
          {transfer.status === "ANNULE" && (
            <>
              <p className="text-center text-[10px] font-bold uppercase tracking-wide">
                Transfert annulé
              </p>
              {transfer.cancelledAt && (
                <p className="text-center text-black/60">
                  {dateFmt(transfer.cancelledAt)}
                  {transfer.cancelledBy ? ` · ${transfer.cancelledBy.name}` : ""}
                </p>
              )}
              {transfer.cancelReason && (
                <p className="mt-1 text-center text-black/60">Motif : {transfer.cancelReason}</p>
              )}
            </>
          )}

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-center text-[10px]">Document interne, à conserver avec la marchandise</p>
        </div>
      </div>
    </div>
  );
}
