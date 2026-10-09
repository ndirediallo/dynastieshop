import Link from "next/link";
import { Suspense } from "react";
import { HandCoins, Users, Receipt, Eye, ChevronRight, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { cn } from "@/lib/utils";
import { RepaymentDialog } from "./repayment-dialog";
import { BoutiqueFilter } from "./boutique-filter";

const PAGE_SIZE = 20;

// Une vente à crédit n'a pas d'échéance (voir décision produit) : pas de
// notion de retard ici, seulement un solde dû qui diminue au fil des
// remboursements (de simples `Payment` ajoutés après coup, voir actions.ts).
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ boutiqueId?: string; page?: string }>;
}) {
  const user = await requirePageAccess("credits");
  const settings = await getSettings();
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const { boutiqueId, page: pageRaw } = await searchParams;
  // Même règle partout : un non-Super Admin (Caissier par défaut, ou
  // Logistique avec l'accès "credits" accordé en plus) ne voit que les
  // crédits de SA boutique, jamais la liste complète — seul le Super Admin
  // garde le filtre libre par boutique.
  const effectiveBoutiqueId = isSuperAdmin ? boutiqueId : (user.boutiqueId ?? undefined);
  const page = Math.max(1, Number(pageRaw) || 1);

  const [sales, boutiques] = await Promise.all([
    prisma.sale.findMany({
      where: {
        isCredit: true,
        ...(effectiveBoutiqueId ? { boutiqueId: effectiveBoutiqueId } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        boutique: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    isSuperAdmin
      ? prisma.boutique.findMany({
          where: { type: "BOUTIQUE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const rows = sales.map((sale) => {
    const paid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Math.round((Number(sale.totalAmount) - paid) * 100) / 100;
    return { sale, paid, balance };
  });

  const openRows = rows.filter((r) => r.balance > 0.01);
  const settledRows = rows.filter((r) => r.balance <= 0.01);
  const sortedRows = [
    ...openRows.sort((a, b) => b.balance - a.balance),
    ...settledRows,
  ];

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const totalOutstanding = openRows.reduce((sum, r) => sum + r.balance, 0);
  const customersOwing = new Set(
    openRows.filter((r) => r.sale.customer).map((r) => r.sale.customer!.id)
  ).size;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (effectiveBoutiqueId) params.set("boutiqueId", effectiveBoutiqueId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/credits?${qs}` : "/credits";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={HandCoins}
        title="Crédits"
        description="Ventes à crédit accordées aux revendeurs et suivi des remboursements"
        tint="pink"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total à recouvrer</p>
              <div className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {totalOutstanding.toLocaleString()} {settings.currency}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Toutes ventes à crédit en cours</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HandCoins className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ventes en cours</p>
              <div className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {openRows.length}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Non entièrement remboursées</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm dark:text-amber-400">
              <Receipt className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Clients concernés</p>
              <div className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {customersOwing}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Revendeurs avec un solde dû</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-sm dark:text-blue-400">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isSuperAdmin && (
        <Suspense fallback={null}>
          <BoutiqueFilter boutiques={boutiques} />
        </Suspense>
      )}

      <p className="text-sm font-medium text-muted-foreground">
        {sortedRows.length} vente{sortedRows.length > 1 ? "s" : ""} à crédit
        {totalPages > 1 && (
          <span className="ml-2 font-normal">
            · page {currentPage}/{totalPages}
          </span>
        )}
      </p>

      {sortedRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <HandCoins className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucune vente à crédit pour le moment.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pageRows.map(({ sale, paid, balance }) => {
            const total = Number(sale.totalAmount);
            const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
            const isSettled = balance <= 0.01;

            return (
              <div
                key={sale.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-xl border border-l-[3px] bg-card p-4 sm:flex-nowrap",
                  isSettled ? "border-l-emerald-500" : "border-l-amber-500"
                )}
              >
                <Link
                  href={`/credits/${sale.id}`}
                  className="flex min-w-40 flex-1 flex-wrap items-center gap-4 sm:flex-nowrap"
                >
                  <div className="w-full shrink-0 sm:w-48">
                    <p className="font-semibold">{sale.customer?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.reference} · {sale.boutique.name} ·{" "}
                      {sale.createdAt.toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  <div className="min-w-40 flex-1">
                    <div className="font-figures mb-1 flex justify-between tabular-nums text-xs text-muted-foreground">
                      <span>
                        {paid.toLocaleString()} / {total.toLocaleString()} {settings.currency}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isSettled ? "bg-emerald-500" : "bg-amber-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right sm:w-36">
                    <p className="font-figures font-extrabold tabular-nums">
                      {balance.toLocaleString()} {settings.currency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isSettled ? "Soldée" : "Reste dû"}
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-1.5">
                  <ReceiptDialog
                    url={`/recus/vente/${sale.id}`}
                    fileNameBase={`ticket-${sale.reference}`}
                    triggerRender={
                      <Button variant="ghost" size="icon-sm" title="Voir le reçu" />
                    }
                  >
                    <Eye className="size-3.5" />
                  </ReceiptDialog>

                  {!isSettled ? (
                    <RepaymentDialog
                      saleId={sale.id}
                      balance={balance}
                      currency={settings.currency}
                      activeMethods={settings.activePaymentMethods}
                      small
                    />
                  ) : (
                    <Link href={`/credits/${sale.id}`}>
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {currentPage <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="mr-1 size-4" />
              Précédent
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={pageHref(currentPage - 1)} />}
            >
              <ChevronLeft className="mr-1 size-4" />
              Précédent
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {currentPage} / {totalPages}
          </span>
          {currentPage >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Suivant
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={pageHref(currentPage + 1)} />}
            >
              Suivant
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
