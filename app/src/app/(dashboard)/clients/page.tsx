import { Users, Phone, Mail, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { CustomerDialog } from "./customer-dialog";

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

export default async function ClientsPage() {
  await requirePageAccess("clients");
  const settings = await getSettings();

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { sales: { select: { totalAmount: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Clients"
        description="Fiches clients et historique d'achats"
        tint="pink"
        actions={<CustomerDialog />}
      />

      <p className="text-sm font-medium text-muted-foreground">
        {customers.length} client{customers.length > 1 ? "s" : ""}
      </p>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun client enregistré pour le moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer, index) => {
            const totalSpent = customer.sales.reduce(
              (sum, s) => sum + Number(s.totalAmount),
              0
            );
            const tint = AVATAR_TINTS[index % AVATAR_TINTS.length];

            return (
              <div
                key={customer.id}
                className="flex flex-col gap-3.5 rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${tint.bg} ${tint.fg}`}
                    >
                      {initials(customer.name)}
                    </div>
                    <p className="truncate font-bold leading-tight">{customer.name}</p>
                  </div>
                  <CustomerDialog
                    customer={{
                      id: customer.id,
                      name: customer.name,
                      phone: customer.phone,
                      email: customer.email,
                      address: customer.address,
                    }}
                  />
                </div>

                <div className="h-px bg-border" />

                <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 shrink-0" />
                    {customer.phone || "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 shrink-0" />
                    <span className={customer.email ? "truncate" : ""}>
                      {customer.email || "E-mail non renseigné"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Achats
                    </p>
                    <p className="mt-0.5 text-lg font-semibold">{customer.sales.length}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Total dépensé
                    </p>
                    <p className="mt-0.5 text-lg font-extrabold">
                      {totalSpent.toLocaleString()} {settings.currency}
                    </p>
                  </div>
                </div>

                {customer.sales.length === 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShoppingBag className="size-3.5" />
                    Aucun achat pour le moment
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
