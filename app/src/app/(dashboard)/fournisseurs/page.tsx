import Link from "next/link";
import {
  ClipboardList,
  HandCoins,
  Truck,
  Phone,
  Mail,
  ArrowRight,
  Search,
  Users,
  Wallet,
  PackagePlus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { SupplierDialog } from "./supplier-dialog";

const SORT_OPTIONS = [
  { value: "name", label: "Nom" },
  { value: "debt", label: "Dette" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const AVATAR_TINTS = [
  { bg: "bg-primary/10", fg: "text-primary" },
  { bg: "bg-indigo-500/10", fg: "text-indigo-600 dark:text-indigo-400" },
  { bg: "bg-amber-500/10", fg: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-emerald-500/10", fg: "text-emerald-600 dark:text-emerald-400" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function relativeDate(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

export default async function FournisseursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const user = await requirePageAccess("fournisseurs");
  const settings = await getSettings();
  const { q, sort: sortRaw } = await searchParams;
  const query = q?.trim() || "";
  const sort: SortValue = sortRaw === "debt" ? "debt" : "name";

  const suppliers = await prisma.supplier.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          items: { select: { unitCost: true, quantityOrdered: true, quantityReceived: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  });

  const computed = suppliers.map((supplier) => {
    const totalOrders = supplier.purchaseOrders.length;
    const totalSpent = supplier.purchaseOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((s, item) => s + Number(item.unitCost) * item.quantityOrdered, 0),
      0
    );
    // Dû = marchandise reçue non encore payée (voir SupplierPayment).
    const totalOwed = supplier.purchaseOrders.reduce((sum, order) => {
      const owed = order.items.reduce(
        (s, item) => s + Number(item.unitCost) * item.quantityReceived,
        0
      );
      const paid = order.payments.reduce((s, p) => s + Number(p.amount), 0);
      return sum + Math.max(0, owed - paid);
    }, 0);
    const lastOrderDate = supplier.purchaseOrders[0]?.createdAt ?? null;
    return { supplier, totalOrders, totalSpent, totalOwed, lastOrderDate };
  });

  const sortedSuppliers =
    sort === "debt"
      ? [...computed].sort((a, b) => b.totalOwed - a.totalOwed)
      : computed;

  const grandTotalSpent = computed.reduce((sum, c) => sum + c.totalSpent, 0);
  const grandTotalOwed = computed.reduce((sum, c) => sum + c.totalOwed, 0);
  const suppliersWithDebt = computed.filter((c) => c.totalOwed > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        title="Fournisseurs"
        description="Fiches fournisseurs, historique d'achats et commandes en cours."
        tint="slate"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/fournisseurs/commandes" />}>
              <ClipboardList className="mr-2 size-4" />
              Voir les commandes
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/fournisseurs/dettes" />}>
              <HandCoins className="mr-2 size-4" />
              Dettes fournisseurs
            </Button>
            <SupplierDialog />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fournisseurs</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {suppliers.length}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 shadow-sm dark:text-slate-400">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total dépensé</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight text-primary">
                {grandTotalSpent.toLocaleString()} {settings.currency}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total dû</p>
              <p
                className={`font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight ${grandTotalOwed > 0 ? "text-destructive" : ""}`}
              >
                {grandTotalOwed.toLocaleString()} {settings.currency}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive shadow-sm">
              <HandCoins className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avec une dette</p>
              <p className="font-figures mt-1.5 text-3xl font-bold tabular-nums tracking-tight">
                {suppliersWithDebt}
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm dark:text-amber-400">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form action="/fournisseurs" method="get" className="flex items-end gap-1.5">
          {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              type="search"
              placeholder="Nom du fournisseur..."
              defaultValue={query}
              className="h-9 w-64 pl-8"
            />
          </div>
          <Button type="submit" variant={query ? "default" : "outline"}>
            Rechercher
          </Button>
          {query && (
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href={sort !== "name" ? `/fournisseurs?sort=${sort}` : "/fournisseurs"} />}
            >
              Effacer
            </Button>
          )}
        </form>

        <div className="flex gap-1.5 rounded-full border p-1">
          {SORT_OPTIONS.map((s) => (
            <Button
              key={s.value}
              variant={sort === s.value ? "default" : "ghost"}
              size="sm"
              className="rounded-full"
              nativeButton={false}
              render={
                <Link
                  href={`/fournisseurs?${new URLSearchParams({
                    ...(query ? { q: query } : {}),
                    ...(s.value !== "name" ? { sort: s.value } : {}),
                  }).toString()}`}
                />
              }
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""}
      </p>

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Truck className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {query
              ? `Aucun fournisseur ne correspond à « ${query} ».`
              : "Aucun fournisseur enregistré pour le moment."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSuppliers.map(({ supplier, totalOrders, totalSpent, totalOwed, lastOrderDate }, index) => {
            const tint = AVATAR_TINTS[index % AVATAR_TINTS.length];

            return (
              <div
                key={supplier.id}
                className="flex flex-col gap-3.5 rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${tint.bg} ${tint.fg}`}
                    >
                      {initials(supplier.name)}
                    </div>
                    <p className="truncate font-bold leading-tight">{supplier.name}</p>
                  </div>
                  <SupplierDialog
                    supplier={{
                      id: supplier.id,
                      name: supplier.name,
                      phone: supplier.phone,
                      email: supplier.email,
                      address: supplier.address,
                    }}
                  />
                </div>

                <div className="h-px bg-border" />

                <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 shrink-0" />
                    {supplier.phone || "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0" />
                    <span className={supplier.email ? "truncate" : ""}>
                      {supplier.email || "E-mail non renseigné"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-3 rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Commandes
                    </p>
                    <p className="font-figures mt-0.5 text-lg font-semibold tabular-nums">
                      {totalOrders}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Dépensé
                    </p>
                    <p className="font-figures mt-0.5 break-words text-lg font-extrabold tabular-nums">
                      {totalSpent.toLocaleString()} {settings.currency}
                    </p>
                  </div>
                </div>

                {totalOwed > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                    <p className="text-xs font-bold text-destructive">Dû au fournisseur</p>
                    <p className="font-figures font-extrabold tabular-nums text-destructive">
                      {totalOwed.toLocaleString()} {settings.currency}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {lastOrderDate
                      ? `Dernière commande : ${relativeDate(lastOrderDate)}`
                      : "Aucune commande pour le moment"}
                  </span>
                  <Link
                    href={`/fournisseurs/${supplier.id}`}
                    className="flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Voir
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>

                {user.role === "SUPER_ADMIN" && (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/fournisseurs/commandes/nouvelle?supplierId=${supplier.id}`} />}
                    className="bg-teal-600 text-white hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400"
                  >
                    <PackagePlus className="mr-2 size-4" />
                    Nouvelle commande
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
