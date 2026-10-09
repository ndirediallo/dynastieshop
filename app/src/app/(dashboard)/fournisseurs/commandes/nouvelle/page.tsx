import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PurchaseOrderForm } from "../purchase-order-form";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

export default async function NouvelleCommandePage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect("/fournisseurs/commandes");
  }
  const { supplierId } = await searchParams;

  const [suppliers, entrepot, variants, settings] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    // Toute commande est reçue à l'entrepôt central, toujours — il n'y en a
    // qu'un seul, donc ce n'est pas un choix à présenter à l'utilisateur
    // (voir discussion : un menu à une seule option laisse croire à un choix
    // qui n'existe pas).
    prisma.boutique.findFirst({
      where: { active: true, type: "ENTREPOT" },
    }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: {
        product: { select: { name: true } },
        stocks: { select: { boutiqueId: true, quantity: true } },
      },
      orderBy: { product: { name: "asc" } },
    }),
    getSettings(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Deux points d'entrée possibles vers cette page — "Nouvelle commande"
          depuis la liste des commandes, ou le raccourci par fournisseur
          depuis la page d'accueil Fournisseurs (?supplierId=...) — chacun
          doit ramener là où l'utilisateur était vraiment, pas à une
          destination fixe unique. */}
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href={supplierId ? "/fournisseurs" : "/fournisseurs/commandes"} />}
      >
        <ArrowLeft className="mr-2 size-4" />
        {supplierId ? "Fournisseurs" : "Commandes"}
      </Button>

      <PageHeader
        icon={ClipboardList}
        title="Nouvelle commande fournisseur"
        description="Choisissez le fournisseur, puis les produits commandés."
        tint="slate"
      />
      <PurchaseOrderForm
        suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
        entrepot={entrepot ? { id: entrepot.id, name: entrepot.name } : null}
        currency={settings.currency}
        variants={variants.map((v) => ({
          id: v.id,
          label: variantLabel(v.product, v),
          stock: entrepot
            ? (v.stocks.find((s) => s.boutiqueId === entrepot.id)?.quantity ?? 0)
            : 0,
        }))}
        defaultSupplierId={supplierId}
      />
    </div>
  );
}
