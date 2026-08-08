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
import { expenseSchema, type ExpenseInput } from "@/lib/schemas";
import { createExpense } from "./actions";

const NO_BOUTIQUE = "__none__";

export function ExpenseDialog({
  boutiques,
}: {
  boutiques: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const boutiqueLabels: Record<string, string> = {
    [NO_BOUTIQUE]: "Non liée à une boutique",
    ...Object.fromEntries(boutiques.map((b) => [b.id, b.name])),
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      type: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      boutiqueId: null,
      comment: "",
    },
  });

  const onSubmit = async (values: ExpenseInput) => {
    setIsSubmitting(true);
    try {
      await createExpense(values);
      toast.success("Dépense enregistrée avec succès");
      reset({
        type: "",
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        boutiqueId: null,
        comment: "",
      });
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 size-4" />
        Ajouter une dépense
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle dépense</DialogTitle>
          <DialogDescription>
            Enregistrez une sortie d&apos;argent (loyer, fournitures, transport...).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de dépense</Label>
            <Input id="type" placeholder="Ex: Loyer, Transport..." {...register("type")} />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Boutique concernée (optionnel)</Label>
            <Controller
              control={control}
              name="boutiqueId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_BOUTIQUE}
                  onValueChange={(v) => field.onChange(v === NO_BOUTIQUE ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Non liée à une boutique">
                      {(v: string) => boutiqueLabels[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BOUTIQUE}>Non liée à une boutique</SelectItem>
                    {boutiques.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire (optionnel)</Label>
            <Input id="comment" {...register("comment")} />
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
