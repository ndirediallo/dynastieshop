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
  BROUILLON: "Brouillon",
  ENVOYEE: "Envoyée",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_TOTALE: "Reçue totalement",
  ANNULEE: "Annulée",
};

export default async function CommandesPage() {
  const user = await requirePageAccess("fournisseurs");

  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      boutique: { select: { name: true } },
      items: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Commandes fournisseurs
          </h1>
          <p className="text-sm text-muted-foreground">
            Suivi des commandes et de leur réception.
          </p>
        </div>
        {user.role === "SUPER_ADMIN" && (
          <Button nativeButton={false} render={<Link href="/fournisseurs/commandes/nouvelle" />}>
            <Plus className="mr-2 size-4" />
            Nouvelle commande
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{orders.length} commande(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Lignes</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucune commande enregistrée pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/fournisseurs/commandes/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{order.supplier.name}</TableCell>
                    <TableCell>{order.boutique.name}</TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell>
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
