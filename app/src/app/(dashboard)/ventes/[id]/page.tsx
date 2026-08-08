import { notFound, redirect } from "next/navigation";
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
import { PrintButton } from "./print-button";
import { ReturnDialog } from "./return-dialog";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
  CARTE: "Carte",
  VIREMENT: "Virement",
};

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
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
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
      payments: true,
    },
  });

  if (!sale) notFound();
  if (user.role !== "SUPER_ADMIN" && sale.userId !== user.id) {
    redirect("/unauthorized");
  }

  const returnItems = await prisma.saleReturnItem.findMany({
    where: { saleItem: { saleId: sale.id } },
  });
  const returnedByItem = new Map<string, number>();
  for (const ri of returnItems) {
    returnedByItem.set(
      ri.saleItemId,
      (returnedByItem.get(ri.saleItemId) ?? 0) + ri.quantity
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vente {sale.reference}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("fr-FR", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(sale.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <ReturnDialog
            saleId={sale.id}
            items={sale.items.map((item) => ({
              saleItemId: item.id,
              label: variantLabel(item.variant.product, item.variant),
              quantity: item.quantity,
              alreadyReturned: returnedByItem.get(item.id) ?? 0,
            }))}
          />
          <PrintButton />
        </div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {variantLabel(item.variant.product, item.variant)}
                    {(returnedByItem.get(item.id) ?? 0) > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({returnedByItem.get(item.id)} retourné(s))
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

          <p className="pt-4 text-center text-xs text-muted-foreground">
            Merci de votre confiance — {settings.companyName}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
