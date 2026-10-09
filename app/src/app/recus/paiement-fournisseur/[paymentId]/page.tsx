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

// Symétrique de /recus/remboursement — hors du groupe (dashboard), pas de
// sidebar, pour une impression propre sur une imprimante thermique.
export default async function PaiementFournisseurReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  await requirePageAccess("fournisseurs");
  const { paymentId } = await params;
  const { embed } = await searchParams;
  const settings = await getSettings();

  const payment = await prisma.supplierPayment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { name: true } },
      purchaseOrder: {
        include: {
          supplier: { select: { name: true } },
          boutique: { select: { name: true } },
          user: { select: { name: true } },
          items: {
            include: { variant: { include: { product: { select: { name: true } } } } },
          },
          payments: {
            orderBy: { createdAt: "asc" },
            select: { id: true, amount: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!payment) notFound();

  const { purchaseOrder: order } = payment;
  const owed = order.items.reduce(
    (sum, item) => sum + Number(item.unitCost) * item.quantityReceived,
    0
  );
  const idx = order.payments.findIndex((p) => p.id === payment.id);
  const paidUpToHere = order.payments
    .slice(0, idx + 1)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceAfter = Math.round((owed - paidUpToHere) * 100) / 100;
  const enregistrePar = payment.user?.name ?? order.user?.name ?? "—";
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
              href={`/fournisseurs/commandes/${order.id}`}
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
            Reçu de paiement fournisseur
          </p>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span>Commande</span>
              <span className="font-semibold">{order.reference}</span>
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
              <span>Fournisseur</span>
              <span className="text-right">{order.supplier.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Boutique</span>
              <span className="text-right">{order.boutique.name}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Enregistré par</span>
              <span className="text-right">{enregistrePar}</span>
            </div>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-[10px] font-bold uppercase tracking-wide">Articles reçus</p>
          <div className="mt-1 space-y-1">
            {order.items.map((item) => (
              <div key={item.id}>
                <div>{variantLabel(item.variant.product, item.variant)}</div>
                <div className="flex justify-between gap-2 text-black/60">
                  <span>
                    {item.quantityReceived} × {Number(item.unitCost).toLocaleString()}
                  </span>
                  <span className="font-semibold">
                    {fmt(Number(item.unitCost) * item.quantityReceived)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="flex justify-between gap-2 text-sm font-bold">
            <span>Montant payé (ce reçu)</span>
            <span className="font-figures tabular-nums">
              {fmt(Number(payment.amount))}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Méthode</span>
            <span>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</span>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <div className="flex justify-between gap-2">
            <span>Total dû</span>
            <span className="font-figures tabular-nums">{fmt(owed)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Total payé à ce jour</span>
            <span className="font-figures tabular-nums">{fmt(paidUpToHere)}</span>
          </div>
          <div className="flex justify-between gap-2 font-bold">
            <span>Solde restant dû</span>
            <span className="font-figures tabular-nums">{fmt(balanceAfter)}</span>
          </div>

          <div className="my-2 border-t border-dashed border-black/30" />

          <p className="text-center text-[10px] font-bold">{settings.companyName}</p>
        </div>
      </div>
    </div>
  );
}
