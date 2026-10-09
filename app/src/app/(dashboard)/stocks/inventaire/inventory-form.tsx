"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Search, TriangleAlert, CircleDashed, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { InventoryInput } from "@/lib/schemas";
import { submitInventory } from "../actions";

interface InventoryLine {
  variantId: string;
  label: string;
  currentQuantity: number;
}

export function InventoryForm({
  boutiqueId,
  lines,
}: {
  boutiqueId: string;
  lines: InventoryLine[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { touchedFields },
  } = useForm<InventoryInput>({
    defaultValues: {
      boutiqueId,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        countedQuantity: l.currentQuantity,
      })),
    },
  });
  const { fields } = useFieldArray({ control, name: "lines" });
  const counted = useWatch({ control, name: "lines" });

  const changes = lines
    .map((line, index) => {
      const countedValue = counted?.[index]?.countedQuantity ?? line.currentQuantity;
      return { ...line, countedValue, delta: countedValue - line.currentQuantity };
    })
    .filter((l) => l.delta !== 0);

  const uncheckedCount = lines.filter(
    (_, index) => !touchedFields.lines?.[index]?.countedQuantity
  ).length;

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fields
      .map((field, index) => ({ field, index }))
      .filter(({ index }) => {
        const line = lines[index];
        if (q && !line.label.toLowerCase().includes(q)) return false;
        if (onlyChanges) {
          const countedValue = counted?.[index]?.countedQuantity ?? line.currentQuantity;
          if (countedValue - line.currentQuantity === 0) return false;
        }
        return true;
      });
  }, [fields, lines, search, onlyChanges, counted]);

  const onSubmit = async (values: InventoryInput) => {
    setIsSubmitting(true);
    try {
      const result = await submitInventory(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        changes.length > 0
          ? `Inventaire enregistré : ${changes.length} référence${changes.length > 1 ? "s" : ""} ajustée${changes.length > 1 ? "s" : ""}`
          : "Inventaire enregistré : aucun écart"
      );
      router.push(`/stocks/inventaire/historique/${result.sessionId}`);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const doSubmit = handleSubmit(onSubmit);

  // Rien à corriger : pas besoin de faire confirmer un geste qui ne change
  // rien (le serveur n'écrit d'ailleurs aucun mouvement dans ce cas).
  const handleValidateClick = handleSubmit((values) => {
    if (changes.length === 0) {
      onSubmit(values);
    } else {
      setConfirmOpen(true);
    }
  });

  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun produit actif à inventorier pour cet emplacement.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          <span className="font-figures">{lines.length}</span> produit
          {lines.length > 1 ? "s" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {uncheckedCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
              <CircleDashed className="size-3.5" />
              <span className="font-figures">{uncheckedCount}</span> non vérifié
              {uncheckedCount > 1 ? "s" : ""}
            </span>
          )}
          {changes.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-3.5" />
              <span className="font-figures">{changes.length}</span> écart
              {changes.length > 1 ? "s" : ""} détecté{changes.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant={onlyChanges ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyChanges((v) => !v)}
        >
          Écarts uniquement
          {onlyChanges && <X className="ml-1.5 size-3.5" />}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Quantité théorique</TableHead>
              <TableHead>Quantité comptée</TableHead>
              <TableHead>Écart</TableHead>
              <TableHead>État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Aucun résultat pour ce filtre.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map(({ field, index }) => {
                const line = lines[index];
                const countedValue = counted?.[index]?.countedQuantity ?? line.currentQuantity;
                const delta = countedValue - line.currentQuantity;
                const isChecked = !!touchedFields.lines?.[index]?.countedQuantity;
                return (
                  <TableRow
                    key={field.id}
                    className={cn(
                      delta > 0 && "bg-amber-500/5",
                      delta < 0 && "bg-destructive/5"
                    )}
                  >
                    <TableCell className="font-medium">{line.label}</TableCell>
                    <TableCell className="font-figures tabular-nums text-muted-foreground">
                      {line.currentQuantity}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="w-24"
                        {...register(`lines.${index}.countedQuantity`, {
                          valueAsNumber: true,
                        })}
                        onFocus={(e) => e.target.select()}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-figures font-bold tabular-nums",
                        delta === 0
                          ? "text-muted-foreground"
                          : delta > 0
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-destructive"
                      )}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </TableCell>
                    <TableCell>
                      {!isChecked && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Non vérifié
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Button type="button" disabled={isSubmitting} onClick={handleValidateClick}>
        {isSubmitting ? "Enregistrement..." : "Valider l'inventaire"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;ajustement du stock</DialogTitle>
            <DialogDescription>
              {changes.length} référence{changes.length > 1 ? "s va" : " va"}{" "}
              {changes.length > 1 ? "être ajustées" : "être ajustée"} pour correspondre au
              comptage physique. Cette action est enregistrée dans le journal d&apos;activité.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {changes.map((c) => (
              <div
                key={c.variantId}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="font-medium">{c.label}</span>
                <span
                  className={cn(
                    "font-figures font-bold tabular-nums",
                    c.delta > 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-destructive"
                  )}
                >
                  {c.currentQuantity} → {c.countedValue} ({c.delta > 0 ? "+" : ""}
                  {c.delta})
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button disabled={isSubmitting} onClick={doSubmit}>
              {isSubmitting ? "Enregistrement..." : "Confirmer l'ajustement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
