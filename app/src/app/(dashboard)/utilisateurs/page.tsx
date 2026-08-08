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
import { ROLE_LABELS } from "@/lib/permissions";
import { UserDialog } from "./user-dialog";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function UtilisateursPage() {
  const [users, boutiques] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { boutique: { select: { name: true } } },
    }),
    prisma.boutique.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Utilisateurs
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les comptes et les rôles des utilisateurs.
          </p>
        </div>
        <UserDialog boutiques={boutiques} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{users.length} utilisateur(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucun utilisateur enregistré pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                    <TableCell>{user.boutique?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "success" : "secondary"}>
                        {user.active ? "Actif" : "Désactivé"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex items-center justify-end gap-2">
                      <ToggleActiveButton id={user.id} active={user.active} />
                      <UserDialog
                        boutiques={boutiques}
                        user={{
                          id: user.id,
                          name: user.name,
                          email: user.email,
                          role: user.role,
                          boutiqueId: user.boutiqueId,
                        }}
                      />
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
