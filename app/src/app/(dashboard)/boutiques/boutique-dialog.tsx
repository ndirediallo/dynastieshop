"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import type { BoutiqueType } from "@prisma/client";
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
import { boutiqueSchema, type BoutiqueInput } from "@/lib/schemas";
import { createBoutique, updateBoutique } from "./actions";

const TYPE_LABELS: Record<BoutiqueType, string> = {
  BOUTIQUE: "Boutique",
  ENTREPOT: "Entrepôt",
};

interface BoutiqueDialogProps {
  boutique?: {
    id: string;
    name: string;
    type: BoutiqueType;
    address: string | null;
    phone: string | null;
  };
}

export function BoutiqueDialog({ boutique }: BoutiqueDialogProps) {
  const isEdit = !!boutique;
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BoutiqueInput>({
    resolver: zodResolver(boutiqueSchema),
    defaultValues: {
      name: boutique?.name ?? "",
      type: boutique?.type ?? "BOUTIQUE",
      address: boutique?.address ?? "",
      phone: boutique?.phone ?? "",
    },
  });

  const onSubmit = async (values: BoutiqueInput) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateBoutique(boutique.id, values);
        toast.success("Boutique modifiée avec succès");
      } else {
        await createBoutique(values);
        toast.success("Boutique créée avec succès");
        reset();
      }
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={isEdit ? <Button variant="ghost" size="icon" /> : <Button />}
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="mr-2 size-4" />
            Ajouter une boutique
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'emplacement" : "Nouvel emplacement"}
          </DialogTitle>
          <DialogDescription>
            Renseignez les informations de la boutique ou de l&apos;entrepôt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type">
                      {(value: BoutiqueType) => TYPE_LABELS[value]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" {...register("address")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" {...register("phone")} />
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
