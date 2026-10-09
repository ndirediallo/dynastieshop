import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "../product-form";

export default async function NouveauProduitPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect("/produits");
  }

  const [categories, settings] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { subCategories: { orderBy: { name: "asc" } } },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        size="sm"
        className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
        nativeButton={false}
        render={<Link href="/produits" />}
      >
        <ArrowLeft className="mr-2 size-4" />
        Produits
      </Button>

      <PageHeader
        icon={PackagePlus}
        title="Nouvel arrivage"
        description="Photo, informations générales, variantes et quantité reçue, tout en une fois. La quantité entre directement dans l'entrepôt"
        tint="blue"
      />
      <ProductForm
        categories={categories}
        currency={settings.currency}
        defaultAlertThreshold={settings.defaultAlertThreshold}
      />
    </div>
  );
}
