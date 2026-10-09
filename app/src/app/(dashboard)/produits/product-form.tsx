"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Lock, Upload, Image as ImageIcon, Info, Palette, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductThumbnail } from "@/components/product-thumbnail";
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
import { SectionIcon } from "@/components/section-icon";
import { cn } from "@/lib/utils";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { resizeImageFile } from "@/lib/resize-image";
import { createProduct, updateProduct, uploadProductImage } from "./actions";

// Marge en direct : même principe que le total qui se recalcule au fil de
// la saisie sur "Nouvelle commande fournisseur" — voir le prix de vente
// dégager (ou pas) une marge avant de valider, pas après.
function MarginHint({
  control,
  index,
}: {
  control: Control<ProductInput>;
  index: number;
}) {
  const purchasePrice = useWatch({ control, name: `variants.${index}.purchasePrice` }) || 0;
  const sellingPrice = useWatch({ control, name: `variants.${index}.sellingPrice` }) || 0;
  const margin = sellingPrice - purchasePrice;
  const pct = purchasePrice > 0 ? Math.round((margin / purchasePrice) * 100) : null;
  const isNegative = margin < 0;

  return (
    <span
      className={cn(
        "font-figures text-sm font-bold tabular-nums",
        isNegative ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
      )}
    >
      {margin > 0 ? "+" : ""}
      {margin.toLocaleString()} {pct !== null && `(${pct > 0 ? "+" : ""}${pct}%)`}
    </span>
  );
}

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
  photoUrl: string | null;
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
    warehouseQuantity: number;
  }[];
}

function emptyVariant(defaultAlertThreshold: number) {
  return {
    variantId: undefined,
    color: "",
    size: "",
    sku: "",
    barcode: "",
    purchasePrice: 0,
    sellingPrice: 0,
    alertThreshold: defaultAlertThreshold,
    active: true,
    receivedQuantity: 0,
  };
}

// Aperçu en direct, à droite du formulaire — occupe l'espace qui restait
// vide sur un grand écran (voir discussion), et montre exactement à quoi
// ressemblera la carte du produit dans le catalogue pendant la saisie.
function ProductPreview({
  control,
  categories,
  photoUrl,
  isBlobUrl,
  currency,
  showQuantity,
}: {
  control: Control<ProductInput>;
  categories: CategoryWithSubs[];
  photoUrl: string | null;
  isBlobUrl: boolean;
  currency: string;
  showQuantity: boolean;
}) {
  const name = useWatch({ control, name: "name" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const variants = useWatch({ control, name: "variants" });

  const category = categories.find((c) => c.id === categoryId);
  const activePrices = (variants ?? [])
    .filter((v) => v?.active !== false)
    .map((v) => Number(v?.sellingPrice) || 0)
    .filter((p) => p > 0);
  const minPrice = activePrices.length ? Math.min(...activePrices) : null;
  const maxPrice = activePrices.length ? Math.max(...activePrices) : null;
  const priceLabel =
    minPrice === null
      ? null
      : minPrice === maxPrice
        ? minPrice.toLocaleString()
        : `dès ${minPrice.toLocaleString()}`;
  const totalQuantity = (variants ?? []).reduce(
    (sum, v) => sum + (Number(v?.receivedQuantity) || 0),
    0
  );

  return (
    <div className="lg:sticky lg:top-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Eye className="size-3.5" />
        Aperçu dans le catalogue
      </p>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt="Aperçu"
              fill
              className="object-cover"
              unoptimized={isBlobUrl}
            />
          ) : (
            <ProductThumbnail
              name={name || "?"}
              photoUrl={null}
              rounded=""
              className="absolute inset-0 text-3xl"
            />
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <p className="line-clamp-2 text-base font-semibold leading-snug">
            {name?.trim() || "Nom du produit"}
          </p>
          {category && (
            <Badge variant="outline" className="w-fit text-xs font-normal">
              {category.name}
            </Badge>
          )}
          {priceLabel ? (
            <p className="whitespace-nowrap font-figures text-lg font-bold tabular-nums text-primary">
              {priceLabel} {currency}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Prix à renseigner</p>
          )}
          {showQuantity && (
            <p className="text-sm text-muted-foreground">
              {totalQuantity} en stock à l&apos;arrivage
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductForm({
  categories,
  product,
  currency,
  defaultAlertThreshold = 5,
}: {
  categories: CategoryWithSubs[];
  product?: ExistingProduct;
  currency: string;
  // Valeur de Paramètres → Stock, pré-remplie sur toute nouvelle variante
  // (création du produit ou ligne ajoutée en édition) — jamais appliquée à
  // une variante déjà enregistrée, dont le seuil propre reste intact.
  defaultAlertThreshold?: number;
}) {
  const isEdit = !!product;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // La photo ne peut être envoyée qu'une fois le produit créé (l'upload a
  // besoin de son id) — elle est donc gardée en mémoire ici, puis envoyée
  // juste après la création, dans le même geste pour l'utilisateur.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // Le redimensionnement (voir resize-image.ts) prend un instant sur une
  // grosse photo — sans ce témoin, un clic sur "Créer le produit" pendant
  // ce court délai soumettait le formulaire avec `photoFile` encore à
  // `null`, perdant silencieusement la photo (aucune erreur affichée).
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const resized = await resizeImageFile(file);
      setPhotoFile(resized);
      setPhotoPreview(URL.createObjectURL(resized));
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const {
    register,
    control,
    handleSubmit,
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
            receivedQuantity: v.warehouseQuantity,
          }))
        : [emptyVariant(defaultAlertThreshold)],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  // Le tableau "couleur/taille" ne concerne qu'une minorité de produits
  // (vêtements...) — la plupart des commerçants n'ont qu'un seul article
  // sans déclinaison. Par défaut, on cache donc ce tableau et on affiche
  // juste les champs prix/seuil/quantité normalement. Un produit qui a déjà
  // plusieurs variantes enregistrées (ou une couleur/taille renseignée)
  // garde le tableau visible en permanence : pas question de masquer des
  // données existantes.
  const alreadyMultiVariant =
    isEdit && (product.variants.length > 1 || product.variants.some((v) => v.color || v.size));
  const [hasVariants, setHasVariants] = useState(alreadyMultiVariant);
  const showVariantsTable = alreadyMultiVariant || hasVariants;

  function handleToggleVariants(checked: boolean) {
    setHasVariants(checked);
    if (!checked) {
      for (let i = fields.length - 1; i > 0; i--) remove(i);
    }
  }

  const selectedCategoryId = useWatch({ control, name: "categoryId" });
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
        if (photoFile) {
          const formData = new FormData();
          formData.set("image", photoFile);
          try {
            await uploadProductImage(result.id, formData);
          } catch {
            // Le produit et son stock sont déjà enregistrés à ce stade —
            // seule la photo a échoué, on ne bloque pas l'utilisateur pour
            // autant (elle reste ajoutable depuis la fiche du produit).
            toast.error("Produit créé, mais l'envoi de la photo a échoué.");
          }
        }
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
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 lg:col-span-2">
      {!isEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={ImageIcon} tint="blue" />
              Photo (optionnel)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {photoPreview ? (
                <Image
                  src={photoPreview}
                  alt="Aperçu du produit"
                  width={80}
                  height={80}
                  className="size-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-center text-xs text-muted-foreground">
                  Aucune image
                </span>
              )}
            </div>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isProcessingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" />
                {isProcessingPhoto
                  ? "Traitement..."
                  : photoFile
                    ? "Changer la photo"
                    : "Ajouter une photo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base font-bold">
            <SectionIcon icon={Info} tint="blue" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nom du produit</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {!showVariantsTable && (
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="simple-purchasePrice">Prix d&apos;achat</Label>
                <Controller
                  control={control}
                  name="variants.0.purchasePrice"
                  render={({ field }) => (
                    <AmountInput
                      id="simple-purchasePrice"
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(digits) => field.onChange(digits ? Number(digits) : 0)}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="simple-sellingPrice">Prix de vente</Label>
                <Controller
                  control={control}
                  name="variants.0.sellingPrice"
                  render={({ field }) => (
                    <AmountInput
                      id="simple-sellingPrice"
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(digits) => field.onChange(digits ? Number(digits) : 0)}
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="simple-alertThreshold">Seuil d&apos;alerte</Label>
                <Input
                  id="simple-alertThreshold"
                  type="number"
                  {...register(`variants.0.alertThreshold`, { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="simple-receivedQuantity">
                  Quantité{isEdit && " (entrepôt central)"}
                </Label>
                <Input
                  id="simple-receivedQuantity"
                  type="number"
                  min={0}
                  {...register(`variants.0.receivedQuantity`, { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 sm:col-span-2 lg:col-span-4">
                <span className="text-xs font-medium text-muted-foreground">
                  Marge dégagée
                </span>
                <MarginHint control={control} index={0} />
              </div>
            </div>
          )}

          {!showVariantsTable && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {isEdit
                ? "La quantité correspond au stock à l'entrepôt central. La modifier crée un ajustement de stock (visible dans Stock). Pour répartir vers une boutique, utilisez un transfert."
                : "La quantité atterrit directement dans l'entrepôt central. Répartissez-la ensuite vers les boutiques via un transfert."}
            </p>
          )}

          {!alreadyMultiVariant && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="has-variants"
                checked={hasVariants}
                onCheckedChange={handleToggleVariants}
              />
              <Label htmlFor="has-variants" className="font-normal text-muted-foreground">
                Ce produit existe en plusieurs couleurs/tailles
              </Label>
            </div>
          )}

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

      {showVariantsTable && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base font-bold">
              <SectionIcon icon={Palette} tint="purple" />
              Variantes (couleur / taille)
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyVariant(defaultAlertThreshold))}
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
                    <TableHead>Prix d&apos;achat</TableHead>
                    <TableHead>Prix de vente</TableHead>
                    <TableHead>Marge</TableHead>
                    <TableHead>Seuil d&apos;alerte</TableHead>
                    <TableHead>{isEdit ? "Quantité (entrepôt)" : "Quantité reçue"}</TableHead>
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
                          <Controller
                            control={control}
                            name={`variants.${index}.purchasePrice`}
                            render={({ field }) => (
                              <AmountInput
                                className="w-28"
                                value={field.value ? String(field.value) : ""}
                                onValueChange={(digits) =>
                                  field.onChange(digits ? Number(digits) : 0)
                                }
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={control}
                            name={`variants.${index}.sellingPrice`}
                            render={({ field }) => (
                              <AmountInput
                                className="w-28"
                                value={field.value ? String(field.value) : ""}
                                onValueChange={(digits) =>
                                  field.onChange(digits ? Number(digits) : 0)
                                }
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <MarginHint control={control} index={index} />
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
                          <Input
                            type="number"
                            min={0}
                            className="w-24"
                            {...register(`variants.${index}.receivedQuantity`, {
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
              supprimées (elles peuvent être liées à des ventes ou du stock).
              Désactivez-les si elles ne sont plus vendues.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEdit
                ? "La quantité correspond au stock à l'entrepôt central. La modifier crée un ajustement de stock (visible dans Stock). Pour répartir vers une boutique, utilisez un transfert."
                : "La quantité reçue atterrit directement dans l'entrepôt central. Répartissez-la ensuite vers les boutiques via un transfert."}
            </p>
          </CardContent>
        </Card>
      )}

      <Button type="submit" disabled={isSubmitting || isProcessingPhoto}>
        {isSubmitting
          ? "Enregistrement..."
          : isProcessingPhoto
            ? "Traitement de la photo..."
            : isEdit
              ? "Enregistrer les modifications"
            : "Créer le produit"}
      </Button>
      </form>

      <ProductPreview
        control={control}
        categories={categories}
        photoUrl={photoPreview || product?.photoUrl || null}
        isBlobUrl={!!photoPreview}
        currency={currency}
        showQuantity={!isEdit}
      />
    </div>
  );
}
