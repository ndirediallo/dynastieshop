import { notFound } from "next/navigation";
import { ClipboardList, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { ReceptionForm } from "./reception-form";
import { PurchaseOrderActions } from "./purchase-order-actions";
import { PurchaseOrderDeleteButton } from "../purchase-order-delete-button";
import { PaymentDialog } from "../../payment-dialog";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_TOTALE: "Reçue totalement",
  ANNULEE: "Annulée",
};

type PaymentStatus = "none" | "partial" | "paid";

function getPaymentStatus(owed: number, paid: number): PaymentStatus {
  if (paid <= 0.01) return "none";
  if (paid >= owed - 0.01) return "paid";
  return "partial";
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  none: "Non payée",
  partial: "Partiellement payée",
  paid: "Payée",
};

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

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess("fournisseurs");
  const canManage = user.role === "SUPER_ADMIN" || user.role === "LOGISTIQUE";
  const { id } = await params;
  const settings = await getSettings();

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      boutique: { select: { name: true } },
      user: { select: { name: true } },
      cancelledBy: { select: { name: true } },
      items: {
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
      payments: { orderBy: { id: "asc" } },
    },
  });

  if (!order) notFound();

  // Le montant dû ne se base que sur la marchandise réellement reçue, pas
  // sur ce qui est seulement commandé (voir SupplierPayment dans le schéma).
  const owed = order.items.reduce(
    (sum, item) => sum + Number(item.unitCost) * item.quantityReceived,
    0
  );
  const paid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.round((owed - paid) * 100) / 100;
  const payStatus = owed > 0 ? getPaymentStatus(owed, paid) : null;
  // La carte "Paiement" s'affiche dès qu'il y a eu réception — même quand
  // le montant dû tombe à 0 (coût unitaire nul, ligne de test...), pour ne
  // jamais laisser la page paraître cassée/vide après la ligne "Avancement".
  const hasReceived = order.items.some((item) => item.quantityReceived > 0);
  const canCancel =
    user.role === "SUPER_ADMIN" &&
    !hasReceived &&
    (order.status === "BROUILLON" || order.status === "ENVOYEE");
  // Suppression : même condition de base que l'annulation (rien reçu), mais
  // sans restriction de statut — une commande déjà annulée reste
  // supprimable, pour pouvoir la faire disparaître de la liste pour de bon.
  const canDelete = user.role === "SUPER_ADMIN" && !hasReceived;

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton label="Retour" />

      <PageHeader
        icon={ClipboardList}
        title={`Commande ${order.reference}`}
        description={`${order.supplier.name} → ${order.boutique.name} · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(order.createdAt)}`}
        tint="slate"
        actions={
          <>
            <Badge
              variant={
                order.status === "RECUE_TOTALE"
                  ? "success"
                  : order.status === "ANNULEE"
                    ? "destructive"
                    : "secondary"
              }
              className="px-3 py-1 text-xs"
            >
              {STATUS_LABELS[order.status]}
            </Badge>
            {payStatus && (
              <Badge
                variant={
                  payStatus === "paid"
                    ? "success"
                    : payStatus === "partial"
                      ? "secondary"
                      : "destructive"
                }
                className="px-3 py-1 text-xs"
              >
                {PAYMENT_STATUS_LABELS[payStatus]}
              </Badge>
            )}
            {balance > 0.01 && canManage && (
              <PaymentDialog
                purchaseOrderId={order.id}
                balance={balance}
                currency={settings.currency}
                activeMethods={settings.activePaymentMethods}
              />
            )}
            {canCancel && <PurchaseOrderActions id={order.id} reference={order.reference} />}
            {canDelete && (
              <PurchaseOrderDeleteButton
                id={order.id}
                reference={order.reference}
                redirectTo="/fournisseurs/commandes"
              />
            )}
          </>
        }
      />

      {order.status === "ANNULEE" && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">
            Commande annulée
            {order.cancelledAt &&
              ` le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(order.cancelledAt)}`}
            {order.cancelledBy?.name ? ` par ${order.cancelledBy.name}` : ""}
          </p>
          {order.cancelReason && (
            <p className="mt-1 text-muted-foreground">« {order.cancelReason} »</p>
          )}
        </div>
      )}

      <ReceptionForm
        purchaseOrderId={order.id}
        cancelled={order.status === "ANNULEE"}
        canReceive={canManage}
        lines={order.items.map((item) => ({
          itemId: item.id,
          label: variantLabel(item.variant.product, item.variant),
          quantityOrdered: item.quantityOrdered,
          quantityReceived: item.quantityReceived,
        }))}
      />

      {hasReceived && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {owed === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun montant dû pour cette commande (coût unitaire à 0).
              </p>
            ) : order.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun paiement enregistré, solde intégralement dû.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {order.payments.map((p) => {
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <span className="text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
                            p.createdAt
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">
                          {Number(p.amount).toLocaleString()} {settings.currency}
                        </span>
                        <ReceiptDialog
                          url={`/recus/paiement-fournisseur/${p.id}`}
                          fileNameBase={`recu-paiement-${order.reference}`}
                          triggerRender={
                            <Button variant="ghost" size="icon-sm" title="Voir le reçu" />
                          }
                        >
                          <Eye className="size-3.5" />
                        </ReceiptDialog>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {owed > 0 && (
              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Montant dû (marchandise reçue)</span>
                  <span>
                    {owed.toLocaleString()} {settings.currency}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total payé</span>
                  <span>
                    {paid.toLocaleString()} {settings.currency}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Solde restant dû</span>
                  <span className={balance > 0.01 ? "text-destructive" : "text-emerald-600"}>
                    {balance.toLocaleString()} {settings.currency}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
