import Link from "next/link";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TransferForm } from "../transfer-form";

function variantLabel(
  product: { name: string },
  variant: { color: string | null; size: string | null }
) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

export default async function NouveauTransfertPage() {
  const user = await requirePageAccess("transferts");
  // Même règle que la liste (/transferts) : un Caissier n'a "transferts"
  // que via un accès supplémentaire, jamais par son rôle seul — il ne peut
  // créer qu'un retour de SA boutique vers l'entrepôt, rien d'autre.
  const isBoutiqueScoped = user.role === "CAISSIER";

  const [boutiques, variants, stocks] = await Promise.all([
    prisma.boutique.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { name: true } } },
      orderBy: { product: { name: "asc" } },
    }),
    prisma.stock.findMany({ select: { boutiqueId: true, variantId: true, quantity: true } }),
  ]);

  // { [boutiqueId]: { [variantId]: quantité } } — pour alerter sur la
  // disponibilité et plafonner la quantité directement dans le
  // formulaire, sans attendre un refus côté serveur.
  const stockMap: Record<string, Record<string, number>> = {};
  for (const s of stocks) {
    (stockMap[s.boutiqueId] ??= {})[s.variantId] = s.quantity;
  }

  const entrepot = boutiques.find((b) => b.type === "ENTREPOT");
  const lockedBoutiques =
    isBoutiqueScoped && user.boutiqueId && entrepot
      ? { fromId: user.boutiqueId, toId: entrepot.id }
      : undefined;

  if (isBoutiqueScoped && !lockedBoutiques) {
    // Compte caissier mal configuré (pas de boutique assignée, ou pas
    // d'entrepôt actif) — on s'arrête plutôt que de laisser passer un
    // formulaire libre pour ce rôle.
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader icon={ArrowLeftRight} title="Nouveau transfert" tint="purple" />
        <p className="text-sm text-destructive">
          Votre compte n&apos;est pas rattaché à une boutique active, ou l&apos;entrepôt central
          est introuvable. Contactez votre Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/transferts" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        Transferts
      </Button>

      <PageHeader
        icon={ArrowLeftRight}
        title="Nouveau transfert"
        description={
          lockedBoutiques
            ? "Retour de stock vers l'entrepôt central."
            : "Le stock ne sera déplacé qu'à la confirmation de réception."
        }
        tint="purple"
      />
      <TransferForm
        boutiques={boutiques.map((b) => ({ id: b.id, label: b.name, type: b.type }))}
        variants={variants.map((v) => ({ id: v.id, label: variantLabel(v.product, v) }))}
        stockMap={stockMap}
        lockedBoutiques={lockedBoutiques}
      />
    </div>
  );
}
