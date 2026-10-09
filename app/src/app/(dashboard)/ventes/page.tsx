import Link from "next/link";
import { ArrowLeft, History, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CaisseClient } from "./caisse-client";

function variantDetail(variant: { color: string | null; size: string | null }) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details || "Standard";
}

export default async function VentesPage() {
  const user = await requirePageAccess("ventes");
  const settings = await getSettings();

  // Un Caissier ne vend que depuis sa propre boutique assignée — même
  // règle pour un Logistique qui aurait reçu "ventes" en accès
  // supplémentaire (jamais la liberté totale que son rôle n'inclut pas par
  // défaut). Un Super Administrateur garde le choix entre toutes les
  // boutiques, même si un `boutiqueId` est renseigné sur son compte (ex.
  // "boutique de rattachement" à titre informatif) — ce champ ne doit pas
  // le restreindre (bug trouvé lors du test bout en bout du cycle de
  // vente, voir échange avec l'utilisateur : le compte de démo Super Admin
  // était rattaché à une boutique et n'avait donc aucun sélecteur en Caisse).
  const boutiques = await prisma.boutique.findMany({
    where: {
      active: true,
      type: "BOUTIQUE",
      ...(user.role !== "SUPER_ADMIN" && user.boutiqueId
        ? { id: user.boutiqueId }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const [products, categories, customers] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: {
        category: { select: { id: true, name: true } },
        variants: {
          where: { active: true },
          include: { stocks: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Un produit sans variante active n'est pas vendable — on ne l'affiche
  // pas comme tuile dans la Caisse (il reste visible/gérable dans Produits).
  const productsForSale = products
    .filter((p) => p.variants.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: p.photoUrl,
      categoryId: p.categoryId,
      variants: p.variants.map((v) => ({
        id: v.id,
        detail: variantDetail(v),
        sku: v.sku,
        barcode: v.barcode,
        sellingPrice: Number(v.sellingPrice),
        alertThreshold: v.alertThreshold,
        stockByBoutique: Object.fromEntries(
          v.stocks.map((s) => [s.boutiqueId, s.quantity])
        ),
      })),
    }));

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        Retour
      </Button>

      <PageHeader
        icon={ShoppingCart}
        title="Caisse"
        description="Choisissez un produit, constituez le panier et encaissez"
        tint="green"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/ventes/historique" />}>
            <History className="mr-2 size-4" />
            Historique des ventes
          </Button>
        }
      />

      {boutiques.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune boutique disponible pour la vente. Contactez votre
          administrateur.
        </p>
      ) : (
        <CaisseClient
          boutiques={boutiques}
          products={productsForSale}
          categories={categories}
          customers={customers}
          currency={settings.currency}
          activeMethods={settings.activePaymentMethods}
          maxDiscountPercent={
            user.role === "SUPER_ADMIN" ? 100 : settings.maxDiscountPercent
          }
          defaultDeliveryFee={settings.defaultDeliveryFee}
        />
      )}
    </div>
  );
}
