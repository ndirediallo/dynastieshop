import { notFound, redirect } from "next/navigation";
import {
  ArrowLeftRight,
  Package,
  Info,
  UserRound,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { SectionHeader } from "@/components/section-header";
import { BackButton } from "@/components/back-button";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { TransferActions } from "../transfer-actions";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

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
  return details ? `${product.name} · ${details}` : product.name;
}

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess("transferts");
  const { id } = await params;

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
  // Même règle que la liste : un Caissier (accès "transferts" accordé en
  // plus de son rôle) ne peut ouvrir que les transferts de SA boutique.
  if (
    user.role === "CAISSIER" &&
    transfer.fromBoutiqueId !== user.boutiqueId &&
    transfer.toBoutiqueId !== user.boutiqueId
  ) {
    redirect("/unauthorized");
  }

  const totalQty = transfer.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-5xl space-y-6">
      <BackButton label="Retour" />

      <PageHeader
        icon={ArrowLeftRight}
        title={`Transfert ${transfer.reference}`}
        description={`${transfer.fromBoutique.name} → ${transfer.toBoutique.name}`}
        tint="purple"
        actions={
          <>
            <ReceiptDialog
              url={`/recus/transfert/${transfer.id}`}
              fileNameBase={`bon-${transfer.reference}`}
              title="Bon de transfert"
              triggerRender={<Button variant="outline" size="sm" />}
            >
              <Eye className="mr-2 size-4" />
              Bon de transfert
            </ReceiptDialog>
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
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <SectionHeader
            icon={Package}
            title="Produits"
            description="Articles concernés par ce transfert"
          />
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
                    <TableCell className="font-figures tabular-nums">
                      {item.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                {transfer.items.length} référence{transfer.items.length > 1 ? "s" : ""}
              </span>
              <span className="font-figures font-bold tabular-nums">
                {totalQty} article{totalQty > 1 ? "s" : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit lg:sticky lg:top-4">
          <SectionHeader icon={Info} title="Informations" description="Historique de ce transfert" />
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2.5">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">
                    Créé{transfer.user ? ` par ${transfer.user.name}` : ""}
                  </p>
                  <p className="font-figures text-xs tabular-nums text-muted-foreground">
                    {dateFormatter.format(transfer.createdAt)}
                  </p>
                </div>
              </li>

              {transfer.status === "EN_ATTENTE" && (
                <li className="flex gap-2.5">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Clock className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">En attente de réception</p>
                    <p className="text-xs text-muted-foreground">
                      Le stock n&apos;a pas encore bougé
                    </p>
                  </div>
                </li>
              )}

              {transfer.status === "VALIDE" && transfer.validatedAt && (
                <li className="flex gap-2.5">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">
                      Confirmé{transfer.validatedBy ? ` par ${transfer.validatedBy.name}` : ""}
                    </p>
                    <p className="font-figures text-xs tabular-nums text-muted-foreground">
                      {dateFormatter.format(transfer.validatedAt)}
                    </p>
                  </div>
                </li>
              )}

              {transfer.status === "ANNULE" && (
                <li className="flex gap-2.5">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <XCircle className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">
                      Annulé{transfer.cancelledBy ? ` par ${transfer.cancelledBy.name}` : ""}
                    </p>
                    {transfer.cancelledAt ? (
                      <p className="font-figures text-xs tabular-nums text-muted-foreground">
                        {dateFormatter.format(transfer.cancelledAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucun stock déplacé</p>
                    )}
                    {transfer.cancelReason && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        « {transfer.cancelReason} »
                      </p>
                    )}
                  </div>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {transfer.status === "EN_ATTENTE" && (
        <TransferActions
          id={transfer.id}
          fromBoutique={transfer.fromBoutique.name}
          toBoutique={transfer.toBoutique.name}
          items={transfer.items.map((item) => ({
            label: variantLabel(item.variant.product, item.variant),
            quantity: item.quantity,
          }))}
        />
      )}
    </div>
  );
}
