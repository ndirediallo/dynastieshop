import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  Truck,
  Wallet,
  HandCoins,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SupplierDialog } from "../supplier-dialog";
import { PaymentDialog } from "../payment-dialog";

const RECEPTION_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYEE: "Non reçue",
  RECUE_PARTIELLE: "Reçue partiellement",
  RECUE_TOTALE: "Reçue totalement",
  ANNULEE: "Annulée",
};

function toDateParam(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Raccourcis de période calculés côté serveur (pas besoin de JS client) :
// chaque pastille est un simple lien vers la même page avec from/to
// précalculés, à l'image des filtres par statut déjà utilisés ailleurs.
function periodPresets() {
  const now = new Date();
  const todayStr = toDateParam(now);

  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const firstOfYear = new Date(now.getFullYear(), 0, 1);
  const lastOfYear = new Date(now.getFullYear(), 11, 31);

  return [
    { label: "Aujourd'hui", from: todayStr, to: todayStr },
    { label: "Cette semaine", from: toDateParam(monday), to: toDateParam(sunday) },
    { label: "Ce mois", from: toDateParam(firstOfMonth), to: toDateParam(lastOfMonth) },
    { label: "Cette année", from: toDateParam(firstOfYear), to: toDateParam(lastOfYear) },
  ];
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requirePageAccess("fournisseurs");
  const canManagePayments = user.role === "SUPER_ADMIN" || user.role === "LOGISTIQUE";
  const { id } = await params;
  const { from, to } = await searchParams;
  const settings = await getSettings();

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (from) createdAtFilter.gte = new Date(`${from}T00:00:00`);
  if (to) createdAtFilter.lte = new Date(`${to}T23:59:59`);

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      supplierId: id,
      ...(from || to ? { createdAt: createdAtFilter } : {}),
    },
    include: {
      boutique: { select: { name: true } },
      items: { select: { unitCost: true, quantityOrdered: true, quantityReceived: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map((order) => {
    const ordered = order.items.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantityOrdered,
      0
    );
    const owed = order.items.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantityReceived,
      0
    );
    const paid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Math.round((owed - paid) * 100) / 100;
    return { order, ordered, owed, paid, balance };
  });

  const totalOrders = rows.length;
  const totalSpent = rows.reduce((sum, r) => sum + r.ordered, 0);
  const totalOwed = rows.reduce((sum, r) => sum + Math.max(0, r.balance), 0);
  const presets = periodPresets();

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/fournisseurs" />}
      >
        <ChevronLeft className="mr-2 size-4" />
        Fournisseurs
      </Button>

      <PageHeader
        icon={Truck}
        title={supplier.name}
        description="Historique des commandes, réceptions et paiements"
        tint="slate"
        actions={
          <SupplierDialog
            supplier={{
              id: supplier.id,
              name: supplier.name,
              phone: supplier.phone,
              email: supplier.email,
              address: supplier.address,
            }}
          />
        }
      />

      <Card>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            {supplier.phone || "—"}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            {supplier.email || "E-mail non renseigné"}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {supplier.address || "Adresse non renseignée"}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Commandes</p>
            <p className="mt-1 font-figures text-2xl font-bold tabular-nums">{totalOrders}</p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-600 text-white shadow-sm">
            <ClipboardList className="size-4" />
          </span>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-xs font-bold text-primary">Dépensé</p>
            <p className="mt-1 whitespace-nowrap font-figures text-2xl font-bold tabular-nums text-primary">
              {totalSpent.toLocaleString()} {settings.currency}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-4" />
          </span>
        </div>

        <div
          className={`flex items-start justify-between gap-3 rounded-xl border p-4 ${
            totalOwed > 0
              ? "border-destructive/20 bg-destructive/5"
              : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          <div>
            <p
              className={`text-xs font-bold ${totalOwed > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              Dû
            </p>
            <p
              className={`mt-1 whitespace-nowrap font-figures text-2xl font-bold tabular-nums ${totalOwed > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {totalOwed.toLocaleString()} {settings.currency}
            </p>
          </div>
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${totalOwed > 0 ? "bg-destructive" : "bg-emerald-500"}`}
          >
            <HandCoins className="size-4" />
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Commandes</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
              <Button
                variant={!from && !to ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                nativeButton={false}
                render={<Link href={`/fournisseurs/${id}`} />}
              >
                Tout
              </Button>
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant={from === p.from && to === p.to ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  nativeButton={false}
                  render={<Link href={`/fournisseurs/${id}?from=${p.from}&to=${p.to}`} />}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <form className="flex flex-wrap items-end gap-2" method="get">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Du</label>
                <Input type="date" name="from" defaultValue={from} className="h-8" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Au</label>
                <Input type="date" name="to" defaultValue={to} className="h-8" />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Personnalisé
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Réception</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead className="text-right">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Aucune commande pour ce filtre.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ order, owed, balance }) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm font-semibold">
                      {order.reference}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {order.createdAt.toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-sm">{order.boutique.name}</TableCell>
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
                        {RECEPTION_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {owed === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : balance <= 0.01 ? (
                        <Badge variant="success">Payée</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          >
                            {balance.toLocaleString()} {settings.currency} dû
                          </Badge>
                          {canManagePayments && (
                            <PaymentDialog
                              purchaseOrderId={order.id}
                              balance={balance}
                              currency={settings.currency}
                              activeMethods={settings.activePaymentMethods}
                              small
                            />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/fournisseurs/commandes/${order.id}`} />}
                      >
                        Voir
                      </Button>
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
