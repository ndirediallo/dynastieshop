"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/amount-input";
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
import { updateSaleItemSchema, type UpdateSaleItemInput } from "@/lib/schemas";
import { updateSaleItem } from "../actions";

// Réservé au Super Admin (voir actions.ts) — corrige une erreur de saisie
// signalée par un Caissier, sans passer par le circuit de retour/avoir :
// la ligne elle-même change, le total de la vente est recalculé.
export function EditSaleItemDialog({
  saleItemId,
  label,
  currentQuantity,
  currentUnitPrice,
}: {
  saleItemId: string;
  label: string;
  currentQuantity: number;
  currentUnitPrice: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateSaleItemInput>({
    resolver: zodResolver(updateSaleItemSchema),
    defaultValues: { quantity: currentQuantity, unitPrice: currentUnitPrice },
  });

  const onSubmit = async (values: UpdateSaleItemInput) => {
    const result = await updateSaleItem(saleItemId, values);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Ligne corrigée, total de la vente mis à jour");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Corriger cette ligne" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corriger la ligne</DialogTitle>
          <DialogDescription>
            {label} : le total de la vente est recalculé automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantité</Label>
            <Input id="edit-quantity" type="number" min={1} {...register("quantity", { valueAsNumber: true })} />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-price">Prix unitaire</Label>
            <Controller
              control={control}
              name="unitPrice"
              render={({ field }) => (
                <AmountInput
                  id="edit-price"
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(digits) => field.onChange(digits ? Number(digits) : 0)}
                />
              )}
            />
            {errors.unitPrice && (
              <p className="text-sm text-destructive">{errors.unitPrice.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Corriger"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
