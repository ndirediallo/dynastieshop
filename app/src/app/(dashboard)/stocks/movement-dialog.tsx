"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stockMovementSchema, type StockMovementInput } from "@/lib/schemas";
import { createManualMovement } from "./actions";

interface VariantOption {
  id: string;
  label: string;
}

interface BoutiqueOption {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<"ENTREE" | "SORTIE", string> = {
  ENTREE: "Entrée (réception, correction +)",
  SORTIE: "Sortie (perte, casse, correction -)",
};

export function MovementDialog({
  boutiques,
  variants,
}: {
  boutiques: BoutiqueOption[];
  variants: VariantOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockMovementInput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: { boutiqueId: "", variantId: "", type: "ENTREE", quantity: 1 },
  });

  const boutiqueLabels = Object.fromEntries(boutiques.map((b) => [b.id, b.name]));
  const variantLabels = Object.fromEntries(variants.map((v) => [v.id, v.label]));

  const onSubmit = async (values: StockMovementInput) => {
    setIsSubmitting(true);
    try {
      const result = await createManualMovement(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Mouvement enregistré avec succès");
      reset({ type: "ENTREE", quantity: 1 });
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 size-4" />
        Nouveau mouvement
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau mouvement de stock</DialogTitle>
          <DialogDescription>
            Pour une entrée ou sortie manuelle (hors vente/achat/transfert).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Emplacement</Label>
            <Controller
              control={control}
              name="boutiqueId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un emplacement">
                      {(v: string) => boutiqueLabels[v] ?? "Choisir un emplacement"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {boutiques.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
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
          <div className="space-y-2">
            <Label>Produit</Label>
            <Controller
              control={control}
              name="variantId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un produit">
                      {(v: string) => variantLabels[v] ?? "Choisir un produit"}
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
            {errors.variantId && (
              <p className="text-sm text-destructive">{errors.variantId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Type de mouvement</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type">
                      {(v: "ENTREE" | "SORTIE") => TYPE_LABELS[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTREE">{TYPE_LABELS.ENTREE}</SelectItem>
                    <SelectItem value="SORTIE">{TYPE_LABELS.SORTIE}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantité</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Motif (optionnel)</Label>
            <Input id="reason" {...register("reason")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
