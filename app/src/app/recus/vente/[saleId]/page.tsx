import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "../../print-button";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Mobile Money",
  WAVE: "Wave",
  CARTE: "Carte",
  VIREMENT: "Virement",
};

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

// Symétrique de /recus/remboursement et /recus/paiement-fournisseur — hors
// du groupe (dashboard), pas de sidebar, pour une impression propre sur
// une imprimante thermique. C'est le reçu le plus utilisé de l'appli (un
// par vente), donc il mérite la même cohérence : popup + imprimer + PDF +
// partage WhatsApp (voir ReceiptDialog).
export default async function VenteReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const user = await requirePageAccess("ventes");
  const { saleId } = await params;
  const { embed } = await searchParams;
  const settings = await getSettings();

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      boutique: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
      user: { select: { name: true } },
      items: {
        include: {
          variant: { include: { product: { select: { name: true } } } },
          returnItems: { select: { quantity: true } },
        },
      },
      payments: true,
    },
  });

  if (!sale) notFound();
  // Même règle que /ventes/[id] : un Caissier voit le reçu de toute vente
  // de SA boutique, pas seulement celles qu'il a lui-même enregistrées
  // (une collègue ou le Super Admin a pu l'enregistrer) — cette page avait
  // encore l'ancienne restriction "propriétaire uniquement" (bug signalé
  // par l'utilisateur : reçu invisible alors qu'il devrait l'être).
  if (user.role !== "SUPER_ADMIN" && sale.boutiqueId !== user.boutiqueId) {
    redirect("/unauthorized");
  }

  const returnedByItem = new Map<string, number>();
  for (const item of sale.items) {
    const returned = item.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    if (returned > 0) returnedByItem.set(item.id, returned);
  }
  const saleReturns = await prisma.saleReturn.findMany({
    where: { saleId: sale.id },
    orderBy: { createdAt: "asc" },
  });

  const fmt = (n: number) => `${n.toLocaleString()} ${settings.currency}`;

  return (
    <div className={`bg-[#f4f4f5] text-black print:bg-white print:py-0 ${embed ? "py-4" : "min-h-screen py-8"}`}>
      <style>{`
        /* Couleurs littérales plutôt que les tokens du thème (oklch) :
           cette page est capturée en image (export PDF/partage WhatsApp,
           voir ReceiptDialog) et html2canvas ne sait pas interpréter
           oklch()/lab() — seules des couleurs simples passent. */
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
              href={`/ventes/${sale.id}`}
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
            Ticket de vente
          </p>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span>Référence</span>
              <span className="font-semibold">{sale.reference}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Date</span>
              <span>
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                  sale.createdAt
                )}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Boutique</span>
              <span className="text-right">{sale.boutique.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Caissier</span>
              <span className="text-right">{sale.user.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Client</span>
              <span className="text-right">{sale.customer?.name ?? "Client de passage"}</span>
            </div>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-[10px] font-bold uppercase tracking-wide">Articles</p>
          <div className="mt-1 space-y-1">
            {sale.items.map((item) => {
              const returned = returnedByItem.get(item.id) ?? 0;
              return (
                <div key={item.id}>
                  <div>
                    {variantLabel(item.variant.product, item.variant)}
                    {returned > 0 && (
                      <span className="text-black/60"> ({returned} retourné{returned > 1 ? "s" : ""})</span>
                    )}
                  </div>
                  <div className="flex justify-between gap-2 text-black/60">
                    <span>
                      {item.quantity} × {Number(item.unitPrice).toLocaleString()}
                    </span>
                    <span className="font-semibold">
                      {fmt(item.quantity * Number(item.unitPrice) - Number(item.discount))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          {Number(sale.discount) > 0 && (
            <div className="flex justify-between gap-2">
              <span>Remise</span>
              <span>-{fmt(Number(sale.discount))}</span>
            </div>
          )}
          {Number(sale.deliveryFee) > 0 && (
            <div className="flex justify-between gap-2">
              <span>Livraison</span>
              <span>{fmt(Number(sale.deliveryFee))}</span>
            </div>
          )}
          <div className="flex justify-between gap-2 text-sm font-bold">
            <span>Total</span>
            <span className="font-figures tabular-nums">{fmt(Number(sale.totalAmount))}</span>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-[10px] font-bold uppercase tracking-wide">Paiement</p>
          <div className="mt-1 space-y-0.5">
            {sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between gap-2">
                <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                <span className="font-figures tabular-nums">{fmt(Number(p.amount))}</span>
              </div>
            ))}
          </div>

          {saleReturns.length > 0 && (
            <>
              <div className="my-2 border-t border-dashed border-black/30" />
              <p className="text-[10px] font-bold uppercase tracking-wide">Remboursements</p>
              <div className="mt-1 space-y-0.5">
                {saleReturns.map((r) => (
                  <div key={r.id} className="flex justify-between gap-2">
                    <span>
                      {r.asStoreCredit ? "Avoir" : PAYMENT_METHOD_LABELS[r.refundMethod!]}
                    </span>
                    <span className="font-figures tabular-nums">
                      -{fmt(Number(r.refundAmount))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-center text-[10px]">Merci de votre confiance</p>
          <p className="text-center text-[10px] font-bold">{settings.companyName}</p>
        </div>
      </div>
    </div>
  );
}
