import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PurchaseOrderForm } from "../purchase-order-form";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function NouvelleCommandePage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect("/fournisseurs/commandes");
  }

  const [suppliers, boutiques, variants] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { name: true } } },
      orderBy: { product: { name: "asc" } },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouvelle commande fournisseur
        </h1>
        <p className="text-sm text-muted-foreground">
          Choisissez le fournisseur, la destination, puis les produits commandés.
        </p>
      </div>
      <PurchaseOrderForm
        suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
        boutiques={boutiques.map((b) => ({ id: b.id, label: b.name }))}
        variants={variants.map((v) => ({ id: v.id, label: variantLabel(v.product, v) }))}
      />
    </div>
  );
}
