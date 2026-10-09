import { notFound } from "next/navigation";
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

// Route volontairement hors du groupe (dashboard) : aucune sidebar, aucun
// header — juste le ticket, pour une impression propre sur une imprimante
// thermique (le client final part avec ça en main, pas une page A4).
export default async function RemboursementReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  await requirePageAccess("credits");
  const { paymentId } = await params;
  const { embed } = await searchParams;
  const settings = await getSettings();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { name: true } },
      sale: {
        include: {
          customer: { select: { name: true } },
          boutique: { select: { name: true } },
          user: { select: { name: true } },
          items: {
            include: { variant: { include: { product: { select: { name: true } } } } },
          },
          payments: {
            orderBy: { createdAt: "asc" },
            select: { id: true, amount: true, method: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!payment || !payment.sale.isCredit) notFound();

  const { sale } = payment;
  const idx = sale.payments.findIndex((p) => p.id === payment.id);
  const paidUpToHere = sale.payments
    .slice(0, idx + 1)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceAfter = Math.round((Number(sale.totalAmount) - paidUpToHere) * 100) / 100;
  const encaissePar = payment.user?.name ?? sale.user.name;
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
              href={`/credits/${sale.id}`}
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
          className="rounded-lg border border-black/10 bg-white text-black p-4 font-mono text-[11px] leading-relaxed print:rounded-none print:border-none print:p-0 print:shadow-none"
        >
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wide">{settings.companyName}</p>
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p>{settings.phone}</p>}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-center text-xs font-bold uppercase tracking-wide">
            Reçu de remboursement
          </p>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span>Vente</span>
              <span className="font-semibold">{sale.reference}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Date</span>
              <span>
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                  payment.createdAt
                )}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Boutique</span>
              <span className="text-right">{sale.boutique.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Client</span>
              <span className="text-right">{sale.customer?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Encaissé par</span>
              <span className="text-right">{encaissePar}</span>
            </div>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-[10px] font-bold uppercase tracking-wide">
            Articles (vente à crédit)
          </p>
          <div className="mt-1 space-y-1">
            {sale.items.map((item) => (
              <div key={item.id}>
                <div>{variantLabel(item.variant.product, item.variant)}</div>
                <div className="flex justify-between gap-2 text-black/60">
                  <span>
                    {item.quantity} × {Number(item.unitPrice).toLocaleString()}
                  </span>
                  <span className="font-semibold">
                    {fmt(item.quantity * Number(item.unitPrice) - Number(item.discount))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-[10px] font-bold uppercase tracking-wide">Paiements</p>
          <div className="mt-1 space-y-1.5">
            {sale.payments.map((p, i) => {
              const isThisOne = p.id === payment.id;
              return (
                <div key={p.id} className={isThisOne ? "font-bold" : undefined}>
                  <div className="flex justify-between gap-2">
                    <span>
                      Paiement {i + 1}
                      {isThisOne ? " (ce reçu)" : ""}
                    </span>
                    <span>
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(p.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-black/60">
                    <span>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                    <span className="font-figures tabular-nums">{fmt(Number(p.amount))}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="flex justify-between gap-2">
            <span>Total de la vente</span>
            <span className="font-figures tabular-nums">{fmt(Number(sale.totalAmount))}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Total remboursé à ce jour</span>
            <span className="font-figures tabular-nums">{fmt(paidUpToHere)}</span>
          </div>
          <div className="flex justify-between gap-2 font-bold">
            <span>Solde restant dû</span>
            <span className="font-figures tabular-nums">{fmt(balanceAfter)}</span>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-center text-[10px]">Merci de votre confiance</p>
          <p className="text-center text-[10px] font-bold">{settings.companyName}</p>
        </div>
      </div>
    </div>
  );
}
