"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
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
import {
  ROLE_LABELS,
  MODULE_LABELS,
  GRANTABLE_EXTRA_MODULES,
  defaultModulesForRole,
} from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import { createUser, updateUser } from "./actions";

const NO_BOUTIQUE = "__none__";

interface UserDialogProps {
  boutiques: { id: string; name: string; type: "BOUTIQUE" | "ENTREPOT" }[];
  user?: {
    id: string;
    name: string;
    phone: string;
    role: Role;
    boutiqueId: string | null;
    extraModules: string[];
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
    setValue,
    formState: { errors },
  } = useForm<UserCreateInput | UserUpdateInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? "CAISSIER",
      boutiqueId: user?.boutiqueId ?? null,
      extraModules: user?.extraModules ?? [],
      ...(isEdit ? { resetPassword: false } : {}),
    },
  });

  // Un Caissier fait des ventes, donc doit être rattaché à une vraie
  // boutique — jamais à l'entrepôt central, qui n'a pas de caisse.
  const role = useWatch({ control, name: "role" });
  const boutiqueId = useWatch({ control, name: "boutiqueId" });
  const boutiqueOptions =
    role === "CAISSIER" ? boutiques.filter((b) => b.type === "BOUTIQUE") : boutiques;

  useEffect(() => {
    if (boutiqueId && !boutiqueOptions.some((b) => b.id === boutiqueId)) {
      setValue("boutiqueId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Les accès déjà couverts par le rôle seul ne sont pas proposés en case à
  // cocher (ils sont acquis) — seuls les modules EN PLUS du rôle le sont.
  // Si le rôle change, on retire du tableau les entrées devenues redondantes.
  const extraModules = useWatch({ control, name: "extraModules" }) ?? [];
  const roleDefaults: string[] = role ? defaultModulesForRole(role) : [];
  const extraOptions = GRANTABLE_EXTRA_MODULES.filter((m) => !roleDefaults.includes(m));
  useEffect(() => {
    setValue(
      "extraModules",
      extraModules.filter((m) => !roleDefaults.includes(m))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

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
              ? "Modifiez les informations du compte."
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
          {isEdit ? (
            <Controller
              control={control}
              name="resetPassword"
              render={({ field }) => (
                <label
                  htmlFor="resetPassword"
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm hover:bg-muted/40"
                >
                  <input
                    id="resetPassword"
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Réinitialiser le mot de passe</span>
                    <span className="block text-xs text-muted-foreground">
                      Remet le mot de passe à 0000. L&apos;utilisateur devra en choisir un
                      nouveau à sa prochaine connexion.
                    </span>
                  </span>
                </label>
              )}
            />
          ) : (
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Mot de passe par défaut : <span className="font-semibold text-foreground">0000</span>.
              L&apos;utilisateur devra en choisir un nouveau dès sa première connexion.
            </p>
          )}
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
                    {boutiqueOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {role === "CAISSIER" && (
              <p className="text-xs text-muted-foreground">
                Un caissier ne peut être rattaché qu&apos;à une boutique, pas à l&apos;entrepôt.
              </p>
            )}
          </div>

          {extraOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Accès supplémentaires (optionnel)</Label>
              <p className="text-xs text-muted-foreground">
                En plus de ce que le rôle « {ROLE_LABELS[role] ?? role} » autorise déjà.
              </p>
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-2">
                {extraOptions.map((m) => (
                  <label
                    key={m}
                    htmlFor={`extra-${m}`}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-muted/60"
                  >
                    {MODULE_LABELS[m]}
                    <Switch
                      id={`extra-${m}`}
                      size="sm"
                      checked={extraModules.includes(m)}
                      onCheckedChange={(checked) =>
                        setValue(
                          "extraModules",
                          checked
                            ? [...extraModules, m]
                            : extraModules.filter((x) => x !== m)
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

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
