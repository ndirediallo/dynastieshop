"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { boutiqueSchema, type BoutiqueInput } from "@/lib/schemas";
import { createBoutique, updateBoutique } from "./actions";

interface BoutiqueDialogProps {
  boutique?: {
    id: string;
    name: string;
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
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BoutiqueInput>({
    resolver: zodResolver(boutiqueSchema),
    defaultValues: {
      name: boutique?.name ?? "",
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
            {isEdit ? "Modifier la boutique" : "Nouvelle boutique"}
          </DialogTitle>
          <DialogDescription>
            Renseignez les informations de la boutique.
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
