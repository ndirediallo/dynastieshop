import Link from "next/link";
import Image from "next/image";
import { ImageOff, Pencil, Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function ProduitsPage() {
  const [session, products, categories] = await Promise.all([
    auth(),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        variants: { select: { id: true, active: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { subCategories: { orderBy: { name: "asc" } } },
    }),
  ]);

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
          <p className="text-sm text-muted-foreground">
            Catalogue et variantes (couleur / taille) de DYNASTIE SHOP.
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <CategoryManagerDialog categories={categories} />
            <Button nativeButton={false} render={<Link href="/produits/nouveau" />}>
              <Plus className="mr-2 size-4" />
              Ajouter un produit
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{products.length} produit(s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead>Statut</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isSuperAdmin ? 7 : 6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Aucun produit enregistré pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const activeVariants = product.variants.filter(
                    (v) => v.active
                  ).length;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {product.photoUrl ? (
                            <Image
                              src={product.photoUrl}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageOff className="size-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.category?.name ?? "—"}
                        {product.subCategory
                          ? ` / ${product.subCategory.name}`
                          : ""}
                      </TableCell>
                      <TableCell>
                        {activeVariants} / {product.variants.length} active(s)
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.active ? "success" : "secondary"}>
                          {product.active ? "Actif" : "Désactivé"}
                        </Badge>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="flex items-center justify-end gap-2">
                          <ToggleActiveButton
                            id={product.id}
                            active={product.active}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            nativeButton={false}
                            render={<Link href={`/produits/${product.id}`} />}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
