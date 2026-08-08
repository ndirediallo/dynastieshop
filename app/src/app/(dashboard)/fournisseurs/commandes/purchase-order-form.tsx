"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { purchaseOrderSchema, type PurchaseOrderInput } from "@/lib/schemas";
import { createPurchaseOrder } from "../actions";

interface Option {
  id: string;
  label: string;
}

export function PurchaseOrderForm({
  suppliers,
  boutiques,
  variants,
}: {
  suppliers: Option[];
  boutiques: Option[];
  variants: Option[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const labelsById = {
    suppliers: Object.fromEntries(suppliers.map((s) => [s.id, s.label])),
    boutiques: Object.fromEntries(boutiques.map((b) => [b.id, b.label])),
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
      supplierId: "",
      boutiqueId: "",
      items: [{ variantId: "", quantityOrdered: 1, unitCost: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

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
                    {(v: string) => labelsById.suppliers[v]}
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
        <div className="space-y-2">
          <Label>Destination</Label>
          <Controller
            control={control}
            name="boutiqueId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir une destination">
                    {(v: string) => labelsById.boutiques[v]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {boutiques.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.boutiqueId && (
            <p className="text-sm text-destructive">{errors.boutiqueId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Produits commandés</Label>
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
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Coût unitaire</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell className="min-w-48">
                    <Controller
                      control={control}
                      name={`items.${index}.variantId`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choisir">
                              {(v: string) => labelsById.variants[v]}
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
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      {...register(`items.${index}.quantityOrdered`, {
                        valueAsNumber: true,
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      {...register(`items.${index}.unitCost`, { valueAsNumber: true })}
                    />
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {errors.items?.root && (
          <p className="text-sm text-destructive">{errors.items.root.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Création..." : "Créer la commande"}
      </Button>
    </form>
  );
}
