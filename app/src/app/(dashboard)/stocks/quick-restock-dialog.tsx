"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
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
import { quickRestockSchema, type QuickRestockInput } from "@/lib/schemas";
import { quickRestockBoutique } from "./actions";

// Raccourci d'un clic : envoie et confirme la réception en même temps
// (contrairement à /transferts/nouveau, qui garde les deux étapes séparées
// pour un suivi "en transit" plus formel).
export function QuickRestockDialog({
  variantId,
  variantLabel,
  maxQuantity,
  boutiques,
}: {
  variantId: string;
  variantLabel: string;
  maxQuantity: number;
  boutiques: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickRestockInput>({
    resolver: zodResolver(quickRestockSchema),
    defaultValues: { variantId, toBoutiqueId: "", quantity: 1 },
  });

  const boutiqueLabels = Object.fromEntries(boutiques.map((b) => [b.id, b.name]));

  const onSubmit = async (values: QuickRestockInput) => {
    setIsSubmitting(true);
    try {
      const result = await quickRestockBoutique(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Envoyé à la boutique");
      reset({ variantId, toBoutiqueId: "", quantity: 1 });
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Send className="mr-2 size-3.5" />
        Envoyer vers une boutique
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer vers une boutique</DialogTitle>
          <DialogDescription>
            {variantLabel} · {maxQuantity} disponible(s) à l&apos;entrepôt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Boutique</Label>
            <Controller
              control={control}
              name="toBoutiqueId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir une boutique">
                      {(v: string) => boutiqueLabels[v] ?? "Choisir une boutique"}
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
            {errors.toBoutiqueId && (
              <p className="text-sm text-destructive">{errors.toBoutiqueId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantité</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={maxQuantity}
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
