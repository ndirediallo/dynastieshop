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
import { ExpenseDialog } from "./expense-dialog";

export default async function DepensesPage() {
  await requirePageAccess("depenses");
  const settings = await getSettings();

  const [expenses, boutiques] = await Promise.all([
    prisma.expense.findMany({
      orderBy: { date: "desc" },
      include: { boutique: { select: { name: true } }, user: { select: { name: true } } },
      take: 200,
    }),
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dépenses</h1>
          <p className="text-sm text-muted-foreground">
            Suivi simple des sorties d&apos;argent.
          </p>
        </div>
        <ExpenseDialog boutiques={boutiques} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {expenses.length} dépense(s) — total {total.toLocaleString()} {settings.currency}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Enregistrée par</TableHead>
                <TableHead>Commentaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucune dépense enregistrée pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                        expense.date
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{expense.type}</TableCell>
                    <TableCell>
                      {Number(expense.amount).toLocaleString()} {settings.currency}
                    </TableCell>
                    <TableCell>{expense.boutique?.name ?? "—"}</TableCell>
                    <TableCell>{expense.user?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.comment ?? "—"}
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
