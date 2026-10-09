"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Settings2, Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fixedExpenseSchema, type FixedExpenseInput } from "@/lib/schemas";
import {
  createFixedExpense,
  updateFixedExpense,
  toggleFixedExpenseActive,
} from "./actions";

const NO_BOUTIQUE = "__none__";

interface FixedExpenseRow {
  id: string;
  label: string;
  amount: number;
  boutiqueId: string | null;
  active: boolean;
}

function FixedExpenseForm({
  defaultValues,
  boutiques,
  onDone,
}: {
  defaultValues: FixedExpenseInput & { id?: string };
  boutiques: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const boutiqueLabels: Record<string, string> = {
    [NO_BOUTIQUE]: "Non liée à une boutique",
    ...Object.fromEntries(boutiques.map((b) => [b.id, b.name])),
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FixedExpenseInput>({
    resolver: zodResolver(fixedExpenseSchema),
    defaultValues,
  });

  const onSubmit = async (values: FixedExpenseInput) => {
    setIsSubmitting(true);
    try {
      if (defaultValues.id) {
        await updateFixedExpense(defaultValues.id, values);
        toast.success("Dépense fixe mise à jour");
      } else {
        await createFixedExpense(values);
        toast.success("Dépense fixe créée");
      }
      onDone();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Libellé</Label>
        <Input id="label" placeholder="Ex : Loyer, Salaires..." {...register("label")} />
        {errors.label && <p className="text-sm text-destructive">{errors.label.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="fixed-amount">Montant habituel</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <AmountInput
              id="fixed-amount"
              value={field.value ? String(field.value) : ""}
              onValueChange={(digits) => field.onChange(digits ? Number(digits) : 0)}
            />
          )}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
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
      <DialogFooter className="static mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : defaultValues.id ? "Mettre à jour" : "Créer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FixedExpenseManagerDialog({
  fixedExpenses,
  boutiques,
}: {
  fixedExpenses: FixedExpenseRow[];
  boutiques: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpenseRow | "new" | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Settings2 className="mr-2 size-4" />
        Dépenses fixes
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dépenses fixes</DialogTitle>
          <DialogDescription>
            Loyer, salaires... des montants récurrents que vous enregistrez d&apos;un clic
            chaque mois depuis la page Dépenses.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <FixedExpenseForm
            defaultValues={
              editing === "new"
                ? { label: "", amount: 0, boutiqueId: null }
                : {
                    id: editing.id,
                    label: editing.label,
                    amount: editing.amount,
                    boutiqueId: editing.boutiqueId,
                  }
            }
            boutiques={boutiques}
            onDone={() => setEditing(null)}
          />
        ) : (
          <>
            <div className="space-y-2">
              {fixedExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune dépense fixe configurée pour le moment.
                </p>
              ) : (
                fixedExpenses.map((fe) => (
                  <div
                    key={fe.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm",
                      !fe.active && "opacity-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{fe.label}</p>
                      <p className="font-figures text-xs tabular-nums text-muted-foreground">
                        {fe.amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(fe)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title={fe.active ? "Archiver" : "Réactiver"}
                        onClick={async () => {
                          await toggleFixedExpenseActive(fe.id, !fe.active);
                          toast.success(fe.active ? "Dépense fixe archivée" : "Dépense fixe réactivée");
                        }}
                      >
                        {fe.active ? (
                          <Archive className="size-3.5" />
                        ) : (
                          <ArchiveRestore className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter className="static mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={() => setEditing("new")}>
                <Plus className="mr-2 size-4" />
                Nouvelle dépense fixe
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
