import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
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
import { Badge } from "@/components/ui/badge";
import { ReceptionForm } from "./reception-form";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_TOTALE: "Reçue totalement",
  ANNULEE: "Annulée",
};

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("fournisseurs");
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      boutique: { select: { name: true } },
      user: { select: { name: true } },
      items: {
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Commande {order.reference}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.supplier.name} → {order.boutique.name}
          </p>
        </div>
        <Badge
          variant={
            order.status === "RECUE_TOTALE"
              ? "success"
              : order.status === "ANNULEE"
                ? "destructive"
                : "secondary"
          }
        >
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lignes commandées</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Commandé</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Coût unitaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {variantLabel(item.variant.product, item.variant)}
                    </TableCell>
                    <TableCell>{item.quantityOrdered}</TableCell>
                    <TableCell>{item.quantityReceived}</TableCell>
                    <TableCell>{Number(item.unitCost).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {order.status !== "ANNULEE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Réception</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceptionForm
              purchaseOrderId={order.id}
              lines={order.items.map((item) => ({
                itemId: item.id,
                label: variantLabel(item.variant.product, item.variant),
                quantityOrdered: item.quantityOrdered,
                quantityReceived: item.quantityReceived,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
