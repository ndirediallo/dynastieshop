import Link from "next/link";
import { HandCoins, Truck, Receipt, ChevronRight, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { cn } from "@/lib/utils";
import { PaymentDialog } from "../payment-dialog";

const PAGE_SIZE = 20;

// Symétrique de /credits, côté fournisseurs. Le montant dû par commande ne
// se base que sur la marchandise réellement reçue (voir SupplierPayment
// dans le schéma) — une commande jamais réceptionnée n'apparaît pas ici.
// Pas de filtre boutique ici (contrairement à /credits) : toute commande
// est systématiquement reçue à l'entrepôt central, qui est unique — un tel
// filtre n'aurait qu'une seule option possible.
export default async function SupplierDebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePageAccess("fournisseurs");
  const canManagePayments = user.role === "SUPER_ADMIN" || user.role === "LOGISTIQUE";
  const settings = await getSettings();
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);

  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["RECUE_PARTIELLE", "RECUE_TOTALE"] } },
    include: {
      supplier: { select: { id: true, name: true } },
      boutique: { select: { name: true } },
      items: { select: { unitCost: true, quantityReceived: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders
    .map((order) => {
      const owed = order.items.reduce(
        (sum, item) => sum + Number(item.unitCost) * item.quantityReceived,
        0
      );
      const paid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = Math.round((owed - paid) * 100) / 100;
      return { order, owed, paid, balance };
    })
    .filter((r) => r.owed > 0);

  const openRows = rows.filter((r) => r.balance > 0.01);
  const settledRows = rows.filter((r) => r.balance <= 0.01);
  const sortedRows = [...openRows.sort((a, b) => b.balance - a.balance), ...settledRows];

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalOutstanding = openRows.reduce((sum, r) => sum + r.balance, 0);
  const suppliersOwing = new Set(openRows.map((r) => r.order.supplier.id)).size;

  const pageHref = (p: number) => (p > 1 ? `/fournisseurs/dettes?page=${p}` : "/fournisseurs/dettes");

  return (
    <div className="space-y-6">
      <BackButton label="Fournisseurs" />

      <PageHeader
        icon={HandCoins}
        title="Dettes fournisseurs"
        description="Marchandise reçue et suivi des paiements dus aux fournisseurs."
        tint="pink"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total dû</p>
              <div className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {totalOutstanding.toLocaleString()} {settings.currency}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Toutes commandes en cours</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HandCoins className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Commandes ouvertes</p>
              <div className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {openRows.length}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Non entièrement payées</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm dark:text-amber-400">
              <Receipt className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fournisseurs concernés</p>
              <div className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {suppliersOwing}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Avec un solde dû</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 shadow-sm dark:text-blue-400">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {sortedRows.length} commande{sortedRows.length > 1 ? "s" : ""} avec marchandise reçue
        {totalPages > 1 && (
          <span className="ml-2 font-normal">
            · page {currentPage}/{totalPages}
          </span>
        )}
      </p>

      {sortedRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <HandCoins className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucune dette fournisseur pour le moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pageRows.map(({ order, owed, paid, balance }) => {
            const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
            const isSettled = balance <= 0.01;

            return (
              <div
                key={order.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 rounded-xl border border-l-[3px] bg-card p-4 sm:flex-nowrap",
                  isSettled ? "border-l-emerald-500" : "border-l-amber-500"
                )}
              >
                <Link
                  href={`/fournisseurs/commandes/${order.id}`}
                  className="flex min-w-40 flex-1 flex-wrap items-center gap-4 sm:flex-nowrap"
                >
                  <div className="w-full shrink-0 sm:w-48">
                    <p className="font-semibold">{order.supplier.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.reference} · {order.boutique.name} ·{" "}
                      {order.createdAt.toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  <div className="min-w-40 flex-1">
                    <div className="font-figures mb-1 flex justify-between tabular-nums text-xs text-muted-foreground">
                      <span>
                        {paid.toLocaleString()} / {owed.toLocaleString()} {settings.currency}
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

                {!isSettled && canManagePayments ? (
                  <PaymentDialog
                    purchaseOrderId={order.id}
                    balance={balance}
                    currency={settings.currency}
                    activeMethods={settings.activePaymentMethods}
                    small
                  />
                ) : (
                  <Link href={`/fournisseurs/commandes/${order.id}`}>
                    <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                  </Link>
                )}
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
