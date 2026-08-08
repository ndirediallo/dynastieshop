"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryInput } from "@/lib/schemas";
import { submitInventory } from "../actions";

interface InventoryLine {
  variantId: string;
  label: string;
  currentQuantity: number;
}

export function InventoryForm({
  boutiqueId,
  lines,
}: {
  boutiqueId: string;
  lines: InventoryLine[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, control, handleSubmit, watch } = useForm<InventoryInput>({
    defaultValues: {
      boutiqueId,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        countedQuantity: l.currentQuantity,
      })),
    },
  });
  const { fields } = useFieldArray({ control, name: "lines" });
  const counted = watch("lines");

  const onSubmit = async (values: InventoryInput) => {
    setIsSubmitting(true);
    try {
      const result = await submitInventory(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Inventaire enregistré avec succès");
      router.push("/stocks");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun produit actif à inventorier pour cet emplacement.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Quantité théorique</TableHead>
              <TableHead>Quantité comptée</TableHead>
              <TableHead>Écart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
              const line = lines[index];
              const countedValue = counted?.[index]?.countedQuantity ?? line.currentQuantity;
              const delta = countedValue - line.currentQuantity;
              return (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.currentQuantity}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      {...register(`lines.${index}.countedQuantity`, {
                        valueAsNumber: true,
                      })}
                    />
                  </TableCell>
                  <TableCell
                    className={
                      delta === 0
                        ? "text-muted-foreground"
                        : delta > 0
                          ? "text-emerald-600"
                          : "text-destructive"
                    }
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enregistrement..." : "Valider l'inventaire"}
      </Button>
    </form>
  );
}
