import Link from "next/link";
import { Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  ANNULE: "Annulé",
};

export default async function TransfertsPage() {
  await requirePageAccess("transferts");

  const transfers = await prisma.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromBoutique: { select: { name: true } },
      toBoutique: { select: { name: true } },
      items: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transferts</h1>
          <p className="text-sm text-muted-foreground">
            Entre boutiques et entrepôt.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/transferts/nouveau" />}>
          <Plus className="mr-2 size-4" />
          Nouveau transfert
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{transfers.length} transfert(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Lignes</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucun transfert enregistré pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/transferts/${t.id}`}
                        className="text-primary hover:underline"
                      >
                        {t.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{t.fromBoutique.name}</TableCell>
                    <TableCell>{t.toBoutique.name}</TableCell>
                    <TableCell>{t.items.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "VALIDE"
                            ? "success"
                            : t.status === "ANNULE"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {STATUS_LABELS[t.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
