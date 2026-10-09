import { notFound, redirect } from "next/navigation";
import { Receipt, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { ReturnDialog } from "./return-dialog";
import { SaleEditRequestDialog } from "./sale-edit-request-dialog";
import { EditSaleItemDialog } from "./edit-sale-item-dialog";
import { ResolveSaleEditRequestButtons } from "./resolve-sale-edit-request-buttons";

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

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess("ventes");
  const { id } = await params;
  const settings = await getSettings();

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      boutique: { select: { name: true, address: true } },
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
  // Un Caissier peut ouvrir n'importe quelle vente de SA boutique (même
  // équipe) — cohérent avec l'historique, désormais scopé pareil.
  if (user.role !== "SUPER_ADMIN" && sale.boutiqueId !== user.boutiqueId) {
    redirect("/unauthorized");
  }

  const returnedByItem = new Map<string, number>();
  for (const item of sale.items) {
    const returned = item.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    if (returned > 0) returnedByItem.set(item.id, returned);
  }
  const paymentsTotal = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const saleReturns = await prisma.saleReturn.findMany({
    where: { saleId: sale.id },
    orderBy: { createdAt: "asc" },
  });
  const editRequests = await prisma.saleEditRequest.findMany({
    where: { saleId: sale.id },
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { name: true } }, resolvedBy: { select: { name: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="print:hidden">
        <div className="mb-4">
          <BackButton label="Retour" />
        </div>

        <PageHeader
          icon={Receipt}
          title={`Vente ${sale.reference}`}
          description={new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(sale.createdAt)}
          tint="green"
          actions={
            <>
              {user.role === "SUPER_ADMIN" ? (
                <ReturnDialog
                  saleId={sale.id}
                  currency={settings.currency}
                  items={sale.items.map((item) => ({
                    saleItemId: item.id,
                    label: variantLabel(item.variant.product, item.variant),
                    quantity: item.quantity,
                    alreadyReturned: returnedByItem.get(item.id) ?? 0,
                    netUnitPrice: Number(item.unitPrice) - Number(item.discount) / item.quantity,
                  }))}
                />
              ) : (
                <SaleEditRequestDialog saleId={sale.id} />
              )}
              <ReceiptDialog
                url={`/recus/vente/${sale.id}`}
                fileNameBase={`ticket-${sale.reference}`}
                triggerRender={<Button variant="outline" />}
              >
                <Eye className="mr-2 size-4" />
                Voir le reçu
              </ReceiptDialog>
            </>
          }
        />
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">{settings.companyName}</CardTitle>
          {settings.address && (
            <p className="text-xs text-muted-foreground">{settings.address}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Référence : </span>
              {sale.reference}
            </div>
            <div>
              <span className="text-muted-foreground">Boutique : </span>
              {sale.boutique.name}
            </div>
            <div>
              <span className="text-muted-foreground">Caissier : </span>
              {sale.user.name}
            </div>
            <div>
              <span className="text-muted-foreground">Client : </span>
              {sale.customer?.name ?? "Client de passage"}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Qté</TableHead>
                <TableHead>P.U.</TableHead>
                <TableHead>Total</TableHead>
                {user.role === "SUPER_ADMIN" && <TableHead className="print:hidden" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {variantLabel(item.variant.product, item.variant)}
                    {(returnedByItem.get(item.id) ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({returnedByItem.get(item.id)} retourné
                        {(returnedByItem.get(item.id) ?? 0) > 1 ? "s" : ""})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{Number(item.unitPrice).toLocaleString()}</TableCell>
                  <TableCell>
                    {(
                      item.quantity * Number(item.unitPrice) -
                      Number(item.discount)
                    ).toLocaleString()}
                  </TableCell>
                  {user.role === "SUPER_ADMIN" && (
                    <TableCell className="print:hidden">
                      <EditSaleItemDialog
                        saleItemId={item.id}
                        label={variantLabel(item.variant.product, item.variant)}
                        currentQuantity={item.quantity}
                        currentUnitPrice={Number(item.unitPrice)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-1 border-t pt-3 text-sm">
            {Number(sale.discount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Remise</span>
                <span>-{Number(sale.discount).toLocaleString()} {settings.currency}</span>
              </div>
            )}
            {Number(sale.deliveryFee) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Livraison</span>
                <span>{Number(sale.deliveryFee).toLocaleString()} {settings.currency}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>
                {Number(sale.totalAmount).toLocaleString()} {settings.currency}
              </span>
            </div>
          </div>

          <div className="space-y-1 border-t pt-3 text-sm">
            <p className="font-medium">Paiement</p>
            {sale.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-muted-foreground">
                <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                <span>
                  {Number(p.amount).toLocaleString()} {settings.currency}
                </span>
              </div>
            ))}
          </div>

          {!sale.isCredit && Math.abs(Number(sale.totalAmount) - paymentsTotal) > 0.01 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              Après correction, le total ({Number(sale.totalAmount).toLocaleString()}{" "}
              {settings.currency}) ne correspond plus aux paiements enregistrés (
              {paymentsTotal.toLocaleString()} {settings.currency}).
            </p>
          )}

          {saleReturns.length > 0 && (
            <div className="space-y-1 border-t pt-3 text-sm">
              <p className="font-medium text-destructive">Remboursements</p>
              {saleReturns.map((r) => (
                <div key={r.id} className="flex justify-between text-muted-foreground">
                  <span>
                    {r.asStoreCredit ? "Avoir" : PAYMENT_METHOD_LABELS[r.refundMethod!]}
                  </span>
                  <span className="text-destructive">
                    -{Number(r.refundAmount).toLocaleString()} {settings.currency}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="pt-4 text-center text-xs text-muted-foreground">
            Merci de votre confiance · {settings.companyName}
          </p>
        </CardContent>
      </Card>

      {editRequests.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Demandes de correction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editRequests.map((req) => (
              <div key={req.id} className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    variant={
                      req.status === "TRAITEE"
                        ? "success"
                        : req.status === "REJETEE"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {req.status === "TRAITEE"
                      ? "Approuvée"
                      : req.status === "REJETEE"
                        ? "Rejetée"
                        : "En attente"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {req.requestedBy?.name ?? "—"} ·{" "}
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
                      req.createdAt
                    )}
                  </span>
                </div>
                <p>{req.reason}</p>
                {req.resolutionNote && (
                  <p className="text-xs text-muted-foreground">
                    Note du Super Admin : {req.resolutionNote}
                  </p>
                )}
                {req.status === "EN_ATTENTE" && user.role === "SUPER_ADMIN" && (
                  <ResolveSaleEditRequestButtons id={req.id} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
