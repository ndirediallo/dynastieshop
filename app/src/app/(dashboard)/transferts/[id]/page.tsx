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
import { TransferActions } from "../transfer-actions";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  ANNULE: "Annulé",
};

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("transferts");
  const { id } = await params;

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromBoutique: { select: { name: true } },
      toBoutique: { select: { name: true } },
      user: { select: { name: true } },
      items: {
        include: { variant: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!transfer) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transfert {transfer.reference}
          </h1>
          <p className="text-sm text-muted-foreground">
            {transfer.fromBoutique.name} → {transfer.toBoutique.name}
          </p>
        </div>
        <Badge
          variant={
            transfer.status === "VALIDE"
              ? "success"
              : transfer.status === "ANNULE"
                ? "destructive"
                : "secondary"
          }
        >
          {STATUS_LABELS[transfer.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produits</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Quantité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {variantLabel(item.variant.product, item.variant)}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {transfer.status === "EN_ATTENTE" && <TransferActions id={transfer.id} />}
    </div>
  );
}
