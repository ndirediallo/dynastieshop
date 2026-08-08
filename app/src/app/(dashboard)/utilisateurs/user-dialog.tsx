"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import type { Role } from "@prisma/client";
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
import {
  userCreateSchema,
  userUpdateSchema,
  type UserCreateInput,
  type UserUpdateInput,
} from "@/lib/schemas";
import { ROLE_LABELS } from "@/lib/permissions";
import { createUser, updateUser } from "./actions";

const NO_BOUTIQUE = "__none__";

interface UserDialogProps {
  boutiques: { id: string; name: string }[];
  user?: {
    id: string;
    name: string;
    phone: string;
    role: Role;
    boutiqueId: string | null;
  };
}

export function UserDialog({ boutiques, user }: UserDialogProps) {
  const isEdit = !!user;
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const schema = isEdit ? userUpdateSchema : userCreateSchema;

  // Base UI's <Select.Value> ne connaît pas le libellé d'un item tant que la
  // liste n'a pas été ouverte au moins une fois : on lui fournit donc une
  // fonction de formatage explicite plutôt que de compter sur la détection
  // automatique (qui affiche sinon la valeur brute, ex. "CAISSIER").
  const boutiqueLabels: Record<string, string> = {
    [NO_BOUTIQUE]: "Aucune boutique",
    ...Object.fromEntries(boutiques.map((b) => [b.id, b.name])),
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserCreateInput | UserUpdateInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? "CAISSIER",
      boutiqueId: user?.boutiqueId ?? null,
      password: "",
    },
  });

  const onSubmit = async (values: UserCreateInput | UserUpdateInput) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await updateUser(user.id, values as UserUpdateInput);
        toast.success("Utilisateur modifié avec succès");
      } else {
        await createUser(values as UserCreateInput);
        toast.success("Utilisateur créé avec succès");
        reset();
      }
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
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
            Ajouter un utilisateur
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Laissez le code PIN vide pour ne pas le modifier."
              : "Renseignez les informations du compte."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Numéro de téléphone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="622269738"
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              Code PIN (4 chiffres) {isEdit && "(optionnel)"}
            </Label>
            <Input
              id="password"
              type="password"
              inputMode="numeric"
              maxLength={4}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un rôle">
                      {(value: Role) => ROLE_LABELS[value] ?? "Sélectionner un rôle"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
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
            <Label>Boutique</Label>
            <Controller
              control={control}
              name="boutiqueId"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_BOUTIQUE}
                  onValueChange={(v) =>
                    field.onChange(v === NO_BOUTIQUE ? null : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aucune boutique">
                      {(value: string) =>
                        boutiqueLabels[value] ?? "Aucune boutique"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BOUTIQUE}>Aucune boutique</SelectItem>
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
