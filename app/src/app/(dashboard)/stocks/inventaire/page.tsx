import Link from "next/link";
import { ArrowLeft, ClipboardList, History, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SectionIcon } from "@/components/section-icon";
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
      label: details ? `${v.product.name} · ${details}` : v.product.name,
      currentQuantity: v.stocks[0]?.quantity ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/stocks" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        Stock
      </Button>

      <PageHeader
        icon={ClipboardList}
        title="Inventaire"
        description="Comparez la quantité comptée physiquement à la quantité théorique"
        tint="amber"
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/stocks/inventaire/historique" />}
          >
            <History className="mr-2 size-4" />
            Historique
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold">
            <SectionIcon icon={MapPin} tint="amber" />
            Emplacement
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 rounded-full border p-1">
            {boutiques.map((b) => (
              <Button
                key={b.id}
                variant={selectedId === b.id ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                nativeButton={false}
                render={<Link href={`/stocks/inventaire?boutiqueId=${b.id}`} />}
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
