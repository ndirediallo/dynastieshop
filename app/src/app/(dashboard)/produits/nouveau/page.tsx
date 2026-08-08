import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "../product-form";

export default async function NouveauProduitPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    redirect("/produits");
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { subCategories: { orderBy: { name: "asc" } } },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau produit
        </h1>
        <p className="text-sm text-muted-foreground">
          Renseignez les informations générales, puis ajoutez au moins une
          variante (couleur / taille).
        </p>
      </div>
      <ProductForm categories={categories} />
    </div>
  );
}
