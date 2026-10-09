import { notFound, redirect } from "next/navigation";
import { HandCoins, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { RepaymentDialog } from "../repayment-dialog";

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

// Page dédiée (distincte de /ventes/[id]) : le recouvrement d'un crédit peut
// être fait par n'importe quel Caissier de la boutique concernée, pas
// seulement celui qui a enregistré la vente initiale. Reste toutefois
// limité à SA boutique, comme partout ailleurs — seul le Super Admin voit
// les crédits de toutes les boutiques.
export default async function CreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess("credits");
  const { id } = await params;
  const settings = await getSettings();

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      boutique: { select: { name: true } },
      customer: { select: { name: true, phone: true } },
      user: { select: { name: true } },
      items: {
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
      payments: { orderBy: { id: "asc" } },
    },
  });

  if (!sale || !sale.isCredit) notFound();
  if (user.role !== "SUPER_ADMIN" && sale.boutiqueId !== user.boutiqueId) {
    redirect("/unauthorized");
  }

  const paid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.round((Number(sale.totalAmount) - paid) * 100) / 100;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <BackButton label="Retour" />
      </div>

      <PageHeader
        icon={HandCoins}
        title={`Vente à crédit ${sale.reference}`}
        description={`${sale.createdAt.toLocaleDateString("fr-FR", { dateStyle: "long" } as never)} · ${sale.boutique.name}`}
        tint="pink"
        actions={
          <>
            <Badge variant={balance > 0.01 ? "secondary" : "success"}>
              {balance > 0.01 ? "En cours" : "Soldée"}
            </Badge>
            {balance > 0.01 && (
              <RepaymentDialog
                saleId={sale.id}
                balance={balance}
                currency={settings.currency}
                activeMethods={settings.activePaymentMethods}
              />
            )}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium">{sale.customer?.name ?? "—"}</p>
          {sale.customer?.phone && (
            <p className="text-muted-foreground">{sale.customer.phone}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Vendu par {sale.user.name}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Qté</TableHead>
                <TableHead>P.U.</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{variantLabel(item.variant.product, item.variant)}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{Number(item.unitPrice).toLocaleString()}</TableCell>
                  <TableCell>
                    {(
                      item.quantity * Number(item.unitPrice) -
                      Number(item.discount)
                    ).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paiements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun acompte versé à la vente, solde intégralement dû.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {sale.payments.map((p) => (
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
                    <span className="font-figures font-medium tabular-nums">
                      {Number(p.amount).toLocaleString()} {settings.currency}
                    </span>
                    <ReceiptDialog
                      url={`/recus/remboursement/${p.id}`}
                      fileNameBase={`recu-remboursement-${sale.reference}`}
                      triggerRender={<Button variant="ghost" size="icon-sm" title="Voir le reçu" />}
                    >
                      <Eye className="size-3.5" />
                    </ReceiptDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total payé</span>
              <span>{paid.toLocaleString()} {settings.currency}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Solde restant dû</span>
              <span className={balance > 0.01 ? "text-destructive" : "text-emerald-600"}>
                {balance.toLocaleString()} {settings.currency}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
