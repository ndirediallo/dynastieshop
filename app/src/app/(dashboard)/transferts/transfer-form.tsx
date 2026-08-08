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
import { stockTransferSchema, type StockTransferInput } from "@/lib/schemas";
import { createStockTransfer } from "./actions";

interface Option {
  id: string;
  label: string;
}

export function TransferForm({
  boutiques,
  variants,
}: {
  boutiques: Option[];
  variants: Option[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const boutiqueLabels = Object.fromEntries(boutiques.map((b) => [b.id, b.label]));
  const variantLabels = Object.fromEntries(variants.map((v) => [v.id, v.label]));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StockTransferInput>({
    resolver: zodResolver(stockTransferSchema),
    defaultValues: {
      fromBoutiqueId: "",
      toBoutiqueId: "",
      items: [{ variantId: "", quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onSubmit = async (values: StockTransferInput) => {
    setIsSubmitting(true);
    try {
      const result = await createStockTransfer(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Transfert ${result.data.reference} créé`);
      router.push(`/transferts/${result.data.id}`);
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
          <Label>Origine</Label>
          <Controller
            control={control}
            name="fromBoutiqueId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir l'origine">
                    {(v: string) => boutiqueLabels[v]}
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
          {errors.fromBoutiqueId && (
            <p className="text-sm text-destructive">{errors.fromBoutiqueId.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Destination</Label>
          <Controller
            control={control}
            name="toBoutiqueId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir la destination">
                    {(v: string) => boutiqueLabels[v]}
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
          {errors.toBoutiqueId && (
            <p className="text-sm text-destructive">{errors.toBoutiqueId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Produits transférés</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ variantId: "", quantity: 1 })}
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
                              {(v: string) => variantLabels[v]}
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
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
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
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Création..." : "Créer le transfert"}
      </Button>
    </form>
  );
}
