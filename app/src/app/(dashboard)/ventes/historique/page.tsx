import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";

export default async function HistoriqueVentesPage() {
  const user = await requirePageAccess("ventes");
  const settings = await getSettings();

  const sales = await prisma.sale.findMany({
    where: user.role === "SUPER_ADMIN" ? undefined : { userId: user.id },
    include: {
      boutique: { select: { name: true } },
      customer: { select: { name: true } },
      user: { select: { name: true } },
      _count: { select: { returns: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Historique des ventes
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.role === "SUPER_ADMIN"
            ? "Toutes les ventes (200 dernières)."
            : "Vos ventes (200 dernières)."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{sales.length} vente(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Caissier</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucune vente enregistrée pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/ventes/${sale.id}`}
                        className="text-primary hover:underline"
                      >
                        {sale.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(sale.createdAt)}
                    </TableCell>
                    <TableCell>{sale.boutique.name}</TableCell>
                    <TableCell>{sale.customer?.name ?? "Client de passage"}</TableCell>
                    <TableCell>{sale.user.name}</TableCell>
                    <TableCell>
                      {Number(sale.totalAmount).toLocaleString()} {settings.currency}
                    </TableCell>
                    <TableCell>
                      {sale._count.returns > 0 ? (
                        <Badge variant="secondary">Retour(s)</Badge>
                      ) : (
                        <Badge variant="success">Validée</Badge>
                      )}
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
