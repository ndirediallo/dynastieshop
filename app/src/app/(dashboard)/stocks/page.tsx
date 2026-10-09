import Link from "next/link";
import { ArrowLeft, ClipboardList, Boxes, LayoutDashboard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { MovementDialog } from "./movement-dialog";
import { StockOverview } from "./stock-overview";

function variantLabel(product: { name: string }, variant: { color: string | null; size: string | null }) {
  const details = [variant.color, variant.size].filter(Boolean).join(" / ");
  return details ? `${product.name} · ${details}` : product.name;
}

export default async function StocksPage({
  searchParams,
}: {
  searchParams: Promise<{ boutiqueId?: string; alert?: string }>;
}) {
  const user = await requirePageAccess("stocks");
  const { boutiqueId, alert } = await searchParams;
  // Un Caissier n'a "stocks" que via un accès supplémentaire — jamais la
  // vue globale de Logistique/Super Admin. Verrouillé sur SA boutique,
  // paramètre d'URL ignoré pour lui (voir plus bas, même logique que
  // Transferts/Dépenses).
  const isBoutiqueScoped = user.role === "CAISSIER";
  // Vue agrégée "toutes les alertes, toutes boutiques" — c'est là que mène
  // la carte "Produits en alerte" du tableau de bord, dont le chiffre
  // compte déjà toutes les boutiques + l'entrepôt. Avant ce correctif, le
  // lien tombait sur la vue par défaut (entrepôt seul), donc le chiffre
  // affiché (ex. 17) ne correspondait jamais à ce qu'on voyait en cliquant
  // dessus (bug signalé par l'utilisateur).
  const isAlertView = alert === "1";

  const boutiques = await prisma.boutique.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  // Toute nouvelle marchandise atterrit dans l'entrepôt central : c'est la
  // vue par défaut de cette page (le menu latéral permet de naviguer vers
  // "Stock global" ou une boutique précise — voir components/sidebar.tsx).
  const entrepot = boutiques.find((b) => b.type === "ENTREPOT");
  // En vue alertes (toutes boutiques), on ne retombe pas sur le défaut
  // "entrepôt seul" : sans boutiqueId explicite dans l'URL, on veut
  // justement TOUTES les boutiques + l'entrepôt (voir requête ci-dessous).
  const effectiveBoutiqueId = isBoutiqueScoped
    ? (user.boutiqueId ?? undefined)
    : isAlertView
      ? boutiqueId
      : (boutiqueId ?? entrepot?.id);
  const currentBoutique = boutiques.find((b) => b.id === effectiveBoutiqueId);
  // Seul l'entrepôt peut recevoir des entrées manuelles / réceptions
  // d'achat — les boutiques ne reçoivent du stock que par transfert.
  const entrepotOptions = boutiques.filter((b) => b.type === "ENTREPOT");
  const isEntrepotView = currentBoutique?.type === "ENTREPOT";
  // Destinations possibles pour le raccourci "Envoyer vers une boutique",
  // uniquement affiché sur la vue Stock global.
  const shopOptions = boutiques.filter((b) => b.type === "BOUTIQUE");

  const [stocks, variants, settings, entrepotStocks] = await Promise.all([
    prisma.stock.findMany({
      where: effectiveBoutiqueId
        ? { boutiqueId: effectiveBoutiqueId }
        : isAlertView
          ? { boutique: { active: true } }
          : undefined,
      include: {
        boutique: { select: { name: true } },
        variant: { include: { product: { select: { name: true } } } },
      },
      orderBy: [{ boutique: { name: "asc" } }, { variant: { product: { name: "asc" } } }],
    }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { name: true } } },
      orderBy: { product: { name: "asc" } },
    }),
    getSettings(),
    // Pour l'aperçu "stock actuel → après mouvement" dans le dialogue
    // "Nouveau mouvement", qui cible toujours un entrepôt quelle que soit
    // la boutique actuellement affichée sur cette page.
    prisma.stock.findMany({
      where: { boutique: { type: "ENTREPOT" } },
      select: { boutiqueId: true, variantId: true, quantity: true },
    }),
  ]);

  const variantOptions = variants.map((v) => ({
    id: v.id,
    label: variantLabel(v.product, v),
  }));

  const entrepotStockMap: Record<string, Record<string, number>> = {};
  for (const s of entrepotStocks) {
    (entrepotStockMap[s.boutiqueId] ??= {})[s.variantId] = s.quantity;
  }

  const allStockLines = stocks.map((s) => ({
    id: s.id,
    variantId: s.variantId,
    label: variantLabel(s.variant.product, s.variant),
    quantity: s.quantity,
    alertThreshold: s.variant.alertThreshold,
    purchasePrice: Number(s.variant.purchasePrice),
    boutiqueName: s.boutique.name,
  }));
  // La vue alertes ne liste que ce qui est effectivement en rupture/faible —
  // même calcul que la carte "Produits en alerte" du tableau de bord
  // (dashboard/page.tsx), pour que le chiffre et ce qu'on voit en cliquant
  // dessus soient enfin cohérents.
  const stockLines = isAlertView
    ? allStockLines.filter((s) => s.quantity <= s.alertThreshold)
    : allStockLines;

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
        icon={Boxes}
        title={
          isAlertView
            ? "Alertes de stock"
            : `Stock${currentBoutique ? ` · ${currentBoutique.name}` : ""}`
        }
        description={
          isAlertView
            ? isBoutiqueScoped
              ? "Produits en rupture ou sous le seuil d'alerte dans votre boutique."
              : "Produits en rupture ou sous le seuil d'alerte, toutes boutiques et entrepôt confondus."
            : currentBoutique?.type === "ENTREPOT"
              ? "Marchandise disponible à l'entrepôt central, avant répartition entre boutiques."
              : "Quantités disponibles dans cette boutique."
        }
        tint="amber"
        actions={
          <>
            {isAlertView && !isBoutiqueScoped && (
              <Button variant="outline" nativeButton={false} render={<Link href="/stocks" />}>
                Voir par boutique
              </Button>
            )}
            {!isAlertView && isEntrepotView && currentBoutique && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/boutiques/${currentBoutique.id}`} />}
              >
                <LayoutDashboard className="mr-2 size-4" />
                Tableau de bord
              </Button>
            )}
            {/* Inventaire et mouvement manuel visent l'entrepôt / nécessitent
                un choix de boutique libre — pas d'usage légitime pour un
                Caissier limité à sa propre boutique, ni pour la vue agrégée
                alertes (pas un seul emplacement cible). */}
            {!isBoutiqueScoped && !isAlertView && (
              <>
                <Button variant="outline" nativeButton={false} render={<Link href="/stocks/inventaire" />}>
                  <ClipboardList className="mr-2 size-4" />
                  Faire un inventaire
                </Button>
                <MovementDialog
                  boutiques={entrepotOptions}
                  variants={variantOptions}
                  stockMap={entrepotStockMap}
                />
              </>
            )}
          </>
        }
      />

      <StockOverview
        stocks={stockLines}
        isEntrepotView={isEntrepotView && !isAlertView}
        shopOptions={shopOptions.map((b) => ({ id: b.id, name: b.name }))}
        currency={settings.currency}
        canSeeValue={!isBoutiqueScoped}
        showBoutiqueColumn={isAlertView && !isBoutiqueScoped}
      />
    </div>
  );
}
