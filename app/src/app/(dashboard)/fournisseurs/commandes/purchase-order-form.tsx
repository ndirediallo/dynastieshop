"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { purchaseOrderSchema, type PurchaseOrderInput } from "@/lib/schemas";
import { createPurchaseOrder } from "../actions";

interface Option {
  id: string;
  label: string;
}

interface VariantOption extends Option {
  stock: number;
}

function LineSubtotal({
  control,
  index,
  currency,
}: {
  control: ReturnType<typeof useForm<PurchaseOrderInput>>["control"];
  index: number;
  currency: string;
}) {
  const quantity = useWatch({ control, name: `items.${index}.quantityOrdered` }) || 0;
  const unitCost = useWatch({ control, name: `items.${index}.unitCost` }) || 0;
  return (
    <span className="font-semibold tabular-nums">
      {(quantity * unitCost).toLocaleString()} {currency}
    </span>
  );
}

function StockHint({
  control,
  index,
  variants,
}: {
  control: ReturnType<typeof useForm<PurchaseOrderInput>>["control"];
  index: number;
  variants: VariantOption[];
}) {
  const variantId = useWatch({ control, name: `items.${index}.variantId` });
  const stock = variants.find((v) => v.id === variantId)?.stock;
  if (!variantId) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums text-muted-foreground">{stock ?? 0}</span>;
}

export function PurchaseOrderForm({
  suppliers,
  entrepot,
  variants,
  currency,
  defaultSupplierId,
}: {
  suppliers: Option[];
  entrepot: { id: string; name: string } | null;
  variants: VariantOption[];
  currency: string;
  defaultSupplierId?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const labelsById = {
    suppliers: Object.fromEntries(suppliers.map((s) => [s.id, s.label])),
    variants: Object.fromEntries(variants.map((v) => [v.id, v.label])),
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: defaultSupplierId ?? "",
      boutiqueId: entrepot?.id ?? "",
      items: [{ variantId: "", quantityOrdered: 1, unitCost: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const total = (watchedItems ?? []).reduce(
    (sum, item) => sum + (item?.quantityOrdered || 0) * (item?.unitCost || 0),
    0
  );

  const onSubmit = async (values: PurchaseOrderInput) => {
    setIsSubmitting(true);
    try {
      const order = await createPurchaseOrder(values);
      toast.success(`Commande ${order.reference} créée`);
      router.push(`/fournisseurs/commandes/${order.id}`);
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...register("boutiqueId")} />
      <div className="rounded-xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Fournisseur</Label>
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un fournisseur">
                      {(v: string) => labelsById.suppliers[v] ?? "Choisir un fournisseur"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.supplierId && (
              <p className="text-sm text-destructive">{errors.supplierId.message}</p>
            )}
          </div>

          {/* Destination : un seul entrepôt existe, donc un texte fixe plutôt
              qu'un menu qui laisserait croire à un choix. */}
          <div className="space-y-2">
            <Label>Destination</Label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm font-medium">
              <Warehouse className="size-4 text-muted-foreground" />
              {entrepot ? entrepot.name : "Aucun entrepôt actif"}
            </div>
            <p className="text-xs text-muted-foreground">
              Toute commande est reçue à l&apos;entrepôt central.
            </p>
            {errors.boutiqueId && (
              <p className="text-sm text-destructive">{errors.boutiqueId.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <Label className="text-sm font-bold">Produits commandés</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ variantId: "", quantityOrdered: 1, unitCost: 0 })}
          >
            <Plus className="mr-2 size-4" />
            Ajouter une ligne
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Produit</th>
                <th className="px-4 py-2.5 text-center">Stock entrepôt</th>
                <th className="px-4 py-2.5 text-center">Quantité</th>
                <th className="px-4 py-2.5 text-center">Coût unitaire</th>
                <th className="px-4 py-2.5 text-right">Sous-total</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-t">
                  <td className="min-w-48 px-4 py-3">
                    <Controller
                      control={control}
                      name={`items.${index}.variantId`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choisir">
                              {(v: string) => labelsById.variants[v] ?? "Choisir"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {variants.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StockHint control={control} index={index} variants={variants} />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={1}
                      className="mx-auto w-24 text-center"
                      {...register(`items.${index}.quantityOrdered`, {
                        valueAsNumber: true,
                      })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="mx-auto w-28 text-center"
                      {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <LineSubtotal control={control} index={index} currency={currency} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.items?.root && (
          <p className="px-4 pb-3 text-sm text-destructive">{errors.items.root.message}</p>
        )}
        <div className="flex items-center justify-end gap-3 border-t bg-muted/30 p-4">
          <span className="text-sm font-medium text-muted-foreground">
            Total de la commande
          </span>
          <span className="text-2xl font-extrabold tabular-nums">
            {total.toLocaleString()} {currency}
          </span>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Création..." : "Créer la commande"}
      </Button>
    </form>
  );
}
