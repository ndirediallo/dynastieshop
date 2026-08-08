import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InventoryForm } from "./inventory-form";

export default async function InventairePage({
  searchParams,
}: {
  searchParams: Promise<{ boutiqueId?: string }>;
}) {
  await requirePageAccess("stocks");
  const { boutiqueId } = await searchParams;
  const boutiques = await prisma.boutique.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const selectedId = boutiqueId ?? boutiques[0]?.id;

  const variants = selectedId
    ? await prisma.productVariant.findMany({
        where: { active: true },
        include: {
          product: { select: { name: true } },
          stocks: { where: { boutiqueId: selectedId } },
        },
        orderBy: { product: { name: "asc" } },
      })
    : [];

  const lines = variants.map((v) => {
    const details = [v.color, v.size].filter(Boolean).join(" / ");
    return {
      variantId: v.id,
      label: details ? `${v.product.name} — ${details}` : v.product.name,
      currentQuantity: v.stocks[0]?.quantity ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventaire</h1>
        <p className="text-sm text-muted-foreground">
          Comparez la quantité comptée physiquement à la quantité théorique.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Emplacement</CardTitle>
          <div className="flex flex-wrap gap-2">
            {boutiques.map((b) => (
              <Button
                key={b.id}
                variant={selectedId === b.id ? "secondary" : "ghost"}
                size="sm"
                nativeButton={false} render={<Link href={`/stocks/inventaire?boutiqueId=${b.id}`} />}
              >
                {b.name}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {selectedId ? (
            <InventoryForm boutiqueId={selectedId} lines={lines} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Créez d&apos;abord une boutique ou un entrepôt.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
