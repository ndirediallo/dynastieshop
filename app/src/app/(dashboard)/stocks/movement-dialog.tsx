"use client";

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, ArrowRight } from "lucide-react";
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
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
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
  stockMap,
}: {
  boutiques: BoutiqueOption[];
  variants: VariantOption[];
  stockMap: Record<string, Record<string, number>>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockMovementInput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      boutiqueId: boutiques.length === 1 ? boutiques[0].id : "",
      variantId: "",
      type: "ENTREE",
      quantity: 1,
      reason: "",
    },
  });

  const boutiqueLabels = Object.fromEntries(boutiques.map((b) => [b.id, b.name]));
  const variantOptions = variants.map((v) => ({ id: v.id, label: v.label }));
  const variantLabels = Object.fromEntries(variants.map((v) => [v.id, v.label]));

  const [watchedBoutiqueId, watchedVariantId, watchedType, watchedQuantity] = useWatch({
    control,
    name: ["boutiqueId", "variantId", "type", "quantity"],
  });

  const currentStock =
    watchedBoutiqueId && watchedVariantId
      ? (stockMap[watchedBoutiqueId]?.[watchedVariantId] ?? 0)
      : null;
  const safeQuantity = Number.isFinite(watchedQuantity) ? watchedQuantity : 0;
  const nextStock =
    currentStock !== null
      ? watchedType === "SORTIE"
        ? currentStock - safeQuantity
        : currentStock + safeQuantity
      : null;

  const closeAndReset = () => {
    reset({
      boutiqueId: boutiques.length === 1 ? boutiques[0].id : "",
      variantId: "",
      type: "ENTREE",
      quantity: 1,
      reason: "",
    });
    setStep("form");
    setOpen(false);
  };

  const goToConfirm = handleSubmit(() => setStep("confirm"));

  const onConfirm = handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const result = await createManualMovement(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Mouvement enregistré avec succès");
      closeAndReset();
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setStep("form");
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 size-4" />
        Nouveau mouvement
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Nouveau mouvement de stock</DialogTitle>
              <DialogDescription>
                Pour une entrée ou sortie manuelle (hors vente/achat/transfert).
                Les nouvelles marchandises entrent toujours par l&apos;entrepôt
                central ; utilisez un transfert pour approvisionner une boutique.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={goToConfirm} className="space-y-4">
              <div className="space-y-2">
                <Label>Emplacement (entrepôt)</Label>
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
                    <Combobox
                      options={variantOptions}
                      value={field.value || null}
                      onValueChange={(v) => field.onChange(v ?? "")}
                      placeholder="Rechercher un produit..."
                      emptyMessage="Aucun produit trouvé."
                    />
                  )}
                />
                {errors.variantId && (
                  <p className="text-sm text-destructive">{errors.variantId.message}</p>
                )}
                {currentStock !== null && (
                  <p className="text-xs text-muted-foreground">
                    Stock actuel à cet emplacement :{" "}
                    <span className="font-figures font-semibold text-foreground">
                      {currentStock}
                    </span>
                  </p>
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
                          {(v: "ENTREE" | "SORTIE") => TYPE_LABELS[v] ?? "Type"}
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
                {currentStock !== null && nextStock !== null && safeQuantity > 0 && (
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="font-figures text-muted-foreground">{currentStock}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span
                      className={cn(
                        "font-figures font-bold",
                        nextStock < 0
                          ? "text-destructive"
                          : watchedType === "SORTIE"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {nextStock}
                    </span>
                    <span className="text-muted-foreground">après ce mouvement</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Motif (optionnel)</Label>
                <Input id="reason" {...register("reason")} />
              </div>
              <DialogFooter>
                <Button type="submit">Continuer</Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirmer le mouvement de stock</DialogTitle>
              <DialogDescription>
                Cette action modifie le stock de l&apos;entrepôt immédiatement et est
                enregistrée dans le journal d&apos;activité.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Emplacement</span>
                <span className="font-medium">{boutiqueLabels[watchedBoutiqueId]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Produit</span>
                <span className="font-medium">{variantLabels[watchedVariantId]}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{TYPE_LABELS[watchedType]}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-2">
                <span className="text-muted-foreground">Stock</span>
                <span className="flex items-center gap-1.5 font-figures font-bold">
                  {currentStock}
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span
                    className={cn(
                      nextStock !== null && nextStock < 0
                        ? "text-destructive"
                        : watchedType === "SORTIE"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {nextStock}
                  </span>
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")}>
                Modifier
              </Button>
              <Button disabled={isSubmitting} onClick={onConfirm}>
                {isSubmitting ? "Enregistrement..." : "Confirmer le mouvement"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
