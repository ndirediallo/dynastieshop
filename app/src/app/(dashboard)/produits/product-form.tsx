"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { createProduct, updateProduct } from "./actions";

const NO_CATEGORY = "__none__";

interface CategoryWithSubs {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
}

interface ExistingProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  active: boolean;
  variants: {
    id: string;
    color: string | null;
    size: string | null;
    sku: string | null;
    barcode: string | null;
    purchasePrice: number;
    sellingPrice: number;
    alertThreshold: number;
    active: boolean;
  }[];
}

const emptyVariant = {
  variantId: undefined,
  color: "",
  size: "",
  sku: "",
  barcode: "",
  purchasePrice: 0,
  sellingPrice: 0,
  alertThreshold: 0,
  active: true,
};

export function ProductForm({
  categories,
  product,
}: {
  categories: CategoryWithSubs[];
  product?: ExistingProduct;
}) {
  const isEdit = !!product;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      description: product?.description ?? "",
      categoryId: product?.categoryId ?? null,
      subCategoryId: product?.subCategoryId ?? null,
      active: product?.active ?? true,
      variants: product
        ? product.variants.map((v) => ({
            variantId: v.id,
            color: v.color ?? "",
            size: v.size ?? "",
            sku: v.sku ?? "",
            barcode: v.barcode ?? "",
            purchasePrice: v.purchasePrice,
            sellingPrice: v.sellingPrice,
            alertThreshold: v.alertThreshold,
            active: v.active,
          }))
        : [emptyVariant],
    },
  });

  const { fields, append } = useFieldArray({ control, name: "variants" });
  const selectedCategoryId = watch("categoryId");
  const subCategories =
    categories.find((c) => c.id === selectedCategoryId)?.subCategories ?? [];

  // Base UI's <Select.Value> ne connaît le libellé d'un item qu'une fois la
  // liste ouverte au moins une fois : on lui fournit donc une fonction de
  // formatage explicite (sinon il affiche l'identifiant brut au premier
  // rendu, ex. "cmsjs3hj...").
  const categoryLabels: Record<string, string> = {
    [NO_CATEGORY]: "Aucune",
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };
  const subCategoryLabels: Record<string, string> = {
    [NO_CATEGORY]: "Aucune",
    ...Object.fromEntries(subCategories.map((s) => [s.id, s.name])),
  };

  const onSubmit = async (values: ProductInput) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateProduct(product.id, values);
        toast.success("Produit modifié avec succès");
        router.refresh();
      } else {
        const result = await createProduct(values);
        toast.success("Produit créé avec succès");
        router.push(`/produits/${result.id}`);
      }
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nom du produit</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">Référence (SKU)</Label>
            <Input id="sku" {...register("sku")} />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Code-barres</Label>
            <Input id="barcode" {...register("barcode")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_CATEGORY}
                  onValueChange={(v) =>
                    field.onChange(v === NO_CATEGORY ? null : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aucune">
                      {(value: string) => categoryLabels[value] ?? "Aucune"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Aucune</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Sous-catégorie</Label>
            <Controller
              control={control}
              name="subCategoryId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_CATEGORY}
                  onValueChange={(v) =>
                    field.onChange(v === NO_CATEGORY ? null : v)
                  }
                  disabled={subCategories.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aucune">
                      {(value: string) => subCategoryLabels[value] ?? "Aucune"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Aucune</SelectItem>
                    {subCategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch
                  id="active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="active">Produit actif</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Variantes (couleur / taille)
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyVariant)}
          >
            <Plus className="mr-2 size-4" />
            Ajouter une variante
          </Button>
        </CardHeader>
        <CardContent>
          {errors.variants?.root && (
            <p className="mb-2 text-sm text-destructive">
              {errors.variants.root.message}
            </p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Couleur</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Code-barres</TableHead>
                  <TableHead>Prix d&apos;achat</TableHead>
                  <TableHead>Prix de vente</TableHead>
                  <TableHead>Seuil d&apos;alerte</TableHead>
                  <TableHead>Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const isExisting = !!field.variantId;
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Input
                          className="w-24"
                          {...register(`variants.${index}.color`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-20"
                          {...register(`variants.${index}.size`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-28"
                          {...register(`variants.${index}.sku`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-32"
                          {...register(`variants.${index}.barcode`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28"
                          {...register(`variants.${index}.purchasePrice`, {
                            valueAsNumber: true,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28"
                          {...register(`variants.${index}.sellingPrice`, {
                            valueAsNumber: true,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20"
                          {...register(`variants.${index}.alertThreshold`, {
                            valueAsNumber: true,
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Controller
                            control={control}
                            name={`variants.${index}.active`}
                            render={({ field: activeField }) => (
                              <Switch
                                checked={activeField.value}
                                onCheckedChange={activeField.onChange}
                              />
                            )}
                          />
                          {isExisting && (
                            <Lock
                              className="size-3.5 text-muted-foreground"
                              aria-label="Variante existante : désactivez-la plutôt que de la supprimer"
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Les variantes déjà enregistrées ({" "}
            <Lock className="mb-0.5 inline size-3" /> ) ne peuvent pas être
            supprimées (elles peuvent être liées à des ventes ou du stock) —
            désactivez-les si elles ne sont plus vendues.
          </p>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Enregistrement..."
          : isEdit
            ? "Enregistrer les modifications"
            : "Créer le produit"}
      </Button>
    </form>
  );
}
