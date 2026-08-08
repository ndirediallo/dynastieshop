import { prisma } from "@/lib/prisma";
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
import { BoutiqueDialog } from "./boutique-dialog";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function BoutiquesPage() {
  const boutiques = await prisma.boutique.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boutiques</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les différentes boutiques de DYNASTIE SHOP.
          </p>
        </div>
        <BoutiqueDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {boutiques.length} boutique(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Utilisateurs</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boutiques.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucune boutique enregistrée pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                boutiques.map((boutique) => (
                  <TableRow key={boutique.id}>
                    <TableCell className="font-medium">
                      {boutique.name}
                    </TableCell>
                    <TableCell>{boutique.address || "—"}</TableCell>
                    <TableCell>{boutique.phone || "—"}</TableCell>
                    <TableCell>{boutique._count.users}</TableCell>
                    <TableCell>
                      <Badge variant={boutique.active ? "success" : "secondary"}>
                        {boutique.active ? "Active" : "Désactivée"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex items-center justify-end gap-2">
                      <ToggleActiveButton
                        id={boutique.id}
                        active={boutique.active}
                      />
                      <BoutiqueDialog boutique={boutique} />
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
