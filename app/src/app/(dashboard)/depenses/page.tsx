import Link from "next/link";
import { Wallet, Repeat, Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { cn } from "@/lib/utils";
import { ExpenseDialog } from "./expense-dialog";
import { FixedExpenseManagerDialog } from "./fixed-expense-dialog";
import { LogFixedExpenseButton } from "./log-fixed-expense-button";

const PERIOD_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
] as const;
type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function getFromDate(period: PeriodValue): Date | undefined {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:
      return undefined;
  }
}

function hrefWithOverrides(
  sp: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key in overrides) continue;
    if (typeof value === "string") params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/depenses?${qs}` : "/depenses";
}

export default async function DepensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess("depenses");
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const settings = await getSettings();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const from = one(sp.from);
  const to = one(sp.to);
  const periodRaw = one(sp.period);
  const period: PeriodValue = PERIOD_OPTIONS.some((p) => p.value === periodRaw)
    ? (periodRaw as PeriodValue)
    : "month";
  const hasCustomRange = !!from || !!to;

  const dateFilter = hasCustomRange
    ? {
        ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
      }
    : (() => {
        const gte = getFromDate(period);
        return gte ? { gte } : undefined;
      })();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Un Caissier avec l'accès "Dépenses" ne voit et n'enregistre que les
  // dépenses de SA boutique — jamais celles des autres (voir discussion
  // avec l'utilisateur). Les dépenses fixes (loyer, salaires...) restent
  // un outil Super Admin uniquement, même celles liées à sa propre
  // boutique : `fixedExpenseId: null` les exclut totalement de sa vue,
  // pas seulement du gestionnaire de modèles — avant ce correctif, une
  // dépense fixe déjà enregistrée pour sa boutique (ex. "Loyer Boutique
  // DAN") apparaissait quand même dans son historique.
  const boutiqueScope = isSuperAdmin
    ? {}
    : { boutiqueId: user.boutiqueId, fixedExpenseId: null };

  const [expenses, fixedExpenses, boutiques, loggedThisMonth] = await Promise.all([
    prisma.expense.findMany({
      where: { ...(dateFilter ? { date: dateFilter } : {}), ...boutiqueScope },
      orderBy: { date: "desc" },
      include: { boutique: { select: { name: true } }, user: { select: { name: true } } },
      take: 200,
    }),
    isSuperAdmin ? prisma.fixedExpense.findMany({ orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    isSuperAdmin
      ? prisma.expense.findMany({
          where: { fixedExpenseId: { not: null }, date: { gte: monthStart } },
          select: { fixedExpenseId: true, date: true },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const viewerBoutiqueName = boutiques.find((b) => b.id === user.boutiqueId)?.name;

  const lastLoggedByTemplate = new Map<string, Date>();
  for (const e of loggedThisMonth) {
    if (e.fixedExpenseId && !lastLoggedByTemplate.has(e.fixedExpenseId)) {
      lastLoggedByTemplate.set(e.fixedExpenseId, e.date);
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const fixedTotal = expenses
    .filter((e) => e.fixedExpenseId)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const autreTotal = total - fixedTotal;
  const activeFixedExpenses = fixedExpenses.filter((fe) => fe.active);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Dépenses"
        description="Suivi des sorties d'argent : fixes et ponctuelles."
        tint="amber"
        actions={
          <>
            {isSuperAdmin && (
              <FixedExpenseManagerDialog
                fixedExpenses={fixedExpenses.map((fe) => ({
                  id: fe.id,
                  label: fe.label,
                  amount: Number(fe.amount),
                  boutiqueId: fe.boutiqueId,
                  active: fe.active,
                }))}
                boutiques={boutiques}
              />
            )}
            <ExpenseDialog
              boutiques={boutiques}
              lockedBoutiqueName={isSuperAdmin ? undefined : (viewerBoutiqueName ?? "—")}
            />
          </>
        }
      />

      <div className={cn("grid gap-4", isSuperAdmin ? "sm:grid-cols-3" : "sm:grid-cols-1")}>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {isSuperAdmin ? "Total dépenses" : "Total dépenses · votre boutique"}
              </p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {total.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{settings.currency}</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm dark:text-amber-400">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>
        {isSuperAdmin && (
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Dépenses fixes</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {fixedTotal.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{settings.currency}</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 shadow-sm dark:text-violet-400">
              <Repeat className="size-5" />
            </div>
          </CardContent>
        </Card>
        )}
        {isSuperAdmin && (
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Autres dépenses</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {autreTotal.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{settings.currency}</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 shadow-sm dark:text-slate-400">
              <Receipt className="size-5" />
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.value}
              variant={!hasCustomRange && period === p.value ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={
                <Link
                  href={hrefWithOverrides(sp, { period: p.value, from: undefined, to: undefined })}
                />
              }
            >
              {p.label}
            </Button>
          ))}
        </div>

        <form action="/depenses" method="get" className="flex flex-wrap items-end gap-1.5">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-[0.7rem] text-muted-foreground">
              Du
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="h-7 w-[9.5rem] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-[0.7rem] text-muted-foreground">
              Au
            </Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="h-7 w-[9.5rem] text-xs"
            />
          </div>
          <Button type="submit" variant={hasCustomRange ? "default" : "outline"} size="sm">
            Appliquer
          </Button>
          {hasCustomRange && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={hrefWithOverrides(sp, { from: undefined, to: undefined })} />}
            >
              Effacer
            </Button>
          )}
        </form>
      </div>

      {isSuperAdmin && activeFixedExpenses.length > 0 && (
        <Card>
          <SectionHeader
            icon={Repeat}
            title="Dépenses fixes"
            description="Loyer, salaires... à enregistrer chaque mois"
            tint="purple"
          />
          <CardContent>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {activeFixedExpenses.map((fe) => {
                const loggedAt = lastLoggedByTemplate.get(fe.id);
                return (
                  <div
                    key={fe.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{fe.label}</p>
                      <p className="font-figures text-sm tabular-nums text-muted-foreground">
                        {Number(fe.amount).toLocaleString()} {settings.currency}
                      </p>
                    </div>
                    {loggedAt ? (
                      <Badge variant="success" className="shrink-0">
                        Fait le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(loggedAt)}
                      </Badge>
                    ) : (
                      <LogFixedExpenseButton id={fe.id} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <SectionHeader
          icon={Receipt}
          title="Historique"
          description={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""} sur la période`}
        />
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
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Aucune dépense enregistrée pour cette période.
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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {expense.type}
                        {expense.fixedExpenseId && (
                          <Badge variant="secondary" className="shrink-0">
                            Fixe
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-figures tabular-nums">
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
