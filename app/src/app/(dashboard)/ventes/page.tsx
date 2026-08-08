import Link from "next/link";
import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { CaisseClient } from "./caisse-client";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} — ${details}` : product.name;
}

export default async function VentesPage() {
  const user = await requirePageAccess("ventes");
  const settings = await getSettings();

  const boutiques = await prisma.boutique.findMany({
    where: {
      active: true,
      type: "BOUTIQUE",
      ...(user.boutiqueId ? { id: user.boutiqueId } : {}),
    },
    orderBy: { name: "asc" },
  });

  const [variants, customers] = await Promise.all([
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { name: true } }, stocks: true },
      orderBy: { product: { name: "asc" } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const variantsForSale = variants.map((v) => ({
    id: v.id,
    label: variantLabel(v.product, v),
    sku: v.sku,
    barcode: v.barcode,
    sellingPrice: Number(v.sellingPrice),
    stockByBoutique: Object.fromEntries(
      v.stocks.map((s) => [s.boutiqueId, s.quantity])
    ),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caisse</h1>
          <p className="text-sm text-muted-foreground">
            Recherchez un produit, constituez le panier et encaissez.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/ventes/historique" />}>
          <History className="mr-2 size-4" />
          Historique des ventes
        </Button>
      </div>

      {boutiques.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune boutique disponible pour la vente. Contactez votre
          administrateur.
        </p>
      ) : (
        <CaisseClient
          boutiques={boutiques}
          variants={variantsForSale}
          customers={customers}
          currency={settings.currency}
        />
      )}
    </div>
  );
}
