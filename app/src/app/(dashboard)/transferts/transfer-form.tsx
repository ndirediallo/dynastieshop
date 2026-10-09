"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Trash2, Route, Package, Boxes, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { stockTransferSchema, type StockTransferInput } from "@/lib/schemas";
import { createStockTransfer } from "./actions";

interface Option {
  id: string;
  label: string;
}

interface BoutiqueOption extends Option {
  type: "BOUTIQUE" | "ENTREPOT";
}


// Champ quantité plafonné au stock disponible. Deux mécanismes
// complémentaires :
// - l'attribut `max` natif empêche les flèches du champ numérique de
//   dépasser la limite (clic sur "+" au-delà du disponible : ignoré) ;
// - le message d'erreur en dessous vient du schéma (voir
//   buildTransferSchema plus bas) — avec un resolver Zod, react-hook-form
//   ignore les règles passées directement à register() (required/max/...),
//   donc la vérification doit vivre dans le schéma pour s'afficher en
//   direct (mode "onChange").
function QuantityField({
  control,
  register,
  errors,
  index,
  fromBoutiqueId,
  stockMap,
}: {
  control: ReturnType<typeof useForm<StockTransferInput>>["control"];
  register: ReturnType<typeof useForm<StockTransferInput>>["register"];
  errors: ReturnType<typeof useForm<StockTransferInput>>["formState"]["errors"];
  index: number;
  fromBoutiqueId: string;
  stockMap: Record<string, Record<string, number>>;
}) {
  const variantId = useWatch({ control, name: `items.${index}.variantId` });
  const available = variantId ? (stockMap[fromBoutiqueId]?.[variantId] ?? 0) : undefined;
  const fieldError = errors.items?.[index]?.quantity;

  return (
    <div className="space-y-1">
      <Input
        type="number"
        min={1}
        max={available}
        className="w-24"
        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
      />
      {fieldError && (
        <p className="whitespace-nowrap text-xs text-destructive">{fieldError.message}</p>
      )}
    </div>
  );
}

// Affiche la quantité disponible à l'origine pour la ligne — composant à
// part pour n'écouter (useWatch) que le variantId de sa propre ligne, pas
// tout le tableau à chaque frappe.
function StockHint({
  control,
  index,
  fromBoutiqueId,
  stockMap,
}: {
  control: ReturnType<typeof useForm<StockTransferInput>>["control"];
  index: number;
  fromBoutiqueId: string;
  stockMap: Record<string, Record<string, number>>;
}) {
  const variantId = useWatch({ control, name: `items.${index}.variantId` });
  if (!variantId) return <span className="text-xs text-muted-foreground">—</span>;
  if (!fromBoutiqueId) {
    return <span className="text-xs text-muted-foreground">Choisissez l&apos;origine</span>;
  }
  const available = stockMap[fromBoutiqueId]?.[variantId] ?? 0;
  return (
    <span
      className={cn(
        "font-figures text-xs tabular-nums",
        available === 0 ? "font-semibold text-destructive" : "text-muted-foreground"
      )}
    >
      {available === 0 ? "Indisponible ici" : `${available} disponible${available > 1 ? "s" : ""}`}
    </span>
  );
}

export function TransferForm({
  boutiques,
  variants,
  stockMap,
  lockedBoutiques,
}: {
  boutiques: BoutiqueOption[];
  variants: Option[];
  stockMap: Record<string, Record<string, number>>;
  // Un Caissier avec l'accès "Transferts" (toujours via un accès
  // supplémentaire, jamais son rôle seul) ne peut envoyer que depuis SA
  // boutique et uniquement vers l'entrepôt central — origine et
  // destination figées, pas de sélecteur du tout (voir nouveau/page.tsx).
  lockedBoutiques?: { fromId: string; toId: string };
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<StockTransferInput | null>(null);
  const boutiqueLabels = Object.fromEntries(boutiques.map((b) => [b.id, b.label]));
  const variantLabels = Object.fromEntries(variants.map((v) => [v.id, v.label]));

  // Le stock disponible dépend de l'origine choisie, connue seulement au
  // moment du rendu (pas dans lib/schemas.ts, partagé et statique) — le
  // schéma est donc complété ici avec cette vérification, pour qu'elle
  // passe par le même pipeline de validation que le reste (et s'affiche
  // en direct, mode "onChange", comme n'importe quelle autre erreur).
  const transferFormSchema = useMemo(
    () =>
      stockTransferSchema.superRefine((data, ctx) => {
        const originStock = stockMap[data.fromBoutiqueId] ?? {};
        data.items.forEach((item, index) => {
          const available = originStock[item.variantId] ?? 0;
          if (item.quantity > available) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["items", index, "quantity"],
              message:
                available === 0
                  ? "Indisponible ici"
                  : `Max. ${available} disponible${available > 1 ? "s" : ""}`,
            });
          }
        });
      }),
    [stockMap]
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<StockTransferInput>({
    resolver: zodResolver(transferFormSchema),
    mode: "onChange",
    defaultValues: {
      fromBoutiqueId: lockedBoutiques?.fromId ?? "",
      toBoutiqueId: lockedBoutiques?.toId ?? "",
      items: [{ variantId: "", quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Un transfert doit toujours passer par l'entrepôt central (voir
  // actions.ts) : une fois l'origine choisie, la destination ne propose que
  // les emplacements du type opposé (Entrepôt → boutiques, ou l'inverse).
  const fromBoutiqueId = useWatch({ control, name: "fromBoutiqueId" });
  const fromType = boutiques.find((b) => b.id === fromBoutiqueId)?.type;
  const destinationOptions = fromType
    ? boutiques.filter((b) => b.id !== fromBoutiqueId && b.type !== fromType)
    : boutiques;
  const toBoutiqueId = useWatch({ control, name: "toBoutiqueId" });

  // Panneau de contexte à côté du formulaire : ce qu'il y a réellement en
  // stock dans la boutique d'origine choisie, pour composer le transfert
  // sans avoir à ouvrir Stock dans un autre onglet.
  const originStockList = fromBoutiqueId
    ? Object.entries(stockMap[fromBoutiqueId] ?? {})
        .filter(([, qty]) => qty > 0)
        .map(([variantId, qty]) => ({ label: variantLabels[variantId] ?? variantId, qty }))
        .sort((a, b) => b.qty - a.qty)
    : [];

  useEffect(() => {
    if (toBoutiqueId && !destinationOptions.some((b) => b.id === toBoutiqueId)) {
      setValue("toBoutiqueId", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBoutiqueId]);

  // Le schéma (transferFormSchema ci-dessus) bloque déjà toute quantité
  // dépassant le stock disponible avant que ce handler ne soit même
  // appelé. Au lieu d'envoyer directement, on ouvre un récapitulatif —
  // l'envoi réel se fait depuis handleConfirm, sur "Oui".
  const onSubmit = (values: StockTransferInput) => {
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingValues) return;
    setIsSubmitting(true);
    try {
      const result = await createStockTransfer(pendingValues);
      if ("error" in result) {
        toast.error(result.error);
        setConfirmOpen(false);
        return;
      }
      toast.success(`Transfert ${result.data.reference} créé`);
      setConfirmOpen(false);
      router.push(`/transferts/${result.data.id}`);
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
      setConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmItems = pendingValues
    ? pendingValues.items.map((item) => ({
        label: variantLabels[item.variantId] ?? item.variantId,
        qty: item.quantity,
      }))
    : [];
  const confirmTotalQty = confirmItems.reduce((sum, item) => sum + item.qty, 0);

  const originTotalQty = originStockList.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <Card>
          <SectionHeader
            icon={Route}
            title="Détails du transfert"
            description="Choisissez l'origine et la destination"
          />
          <CardContent>
            {lockedBoutiques ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm font-semibold">
                <span className="truncate">{boutiqueLabels[lockedBoutiques.fromId]}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{boutiqueLabels[lockedBoutiques.toId]}</span>
                <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">
                  Retour vers l&apos;entrepôt uniquement
                </span>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origine</Label>
                  <Controller
                    control={control}
                    name="fromBoutiqueId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir l'origine">
                            {(v: string) => boutiqueLabels[v] ?? "Choisir l'origine"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {boutiques.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.fromBoutiqueId && (
                    <p className="text-sm text-destructive">{errors.fromBoutiqueId.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Controller
                    control={control}
                    name="toBoutiqueId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!fromBoutiqueId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              fromBoutiqueId ? "Choisir la destination" : "Choisissez d'abord l'origine"
                            }
                          >
                            {(v: string) =>
                              boutiqueLabels[v] ??
                              (fromBoutiqueId ? "Choisir la destination" : "Choisissez d'abord l'origine")
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {destinationOptions.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Un transfert passe toujours par l&apos;entrepôt (Entrepôt ↔ Boutique).
                  </p>
                  {errors.toBoutiqueId && (
                    <p className="text-sm text-destructive">{errors.toBoutiqueId.message}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={Package}
            title="Produits transférés"
            description="Ajoutez les articles à transférer"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ variantId: "", quantity: 1 })}
              >
                <Plus className="mr-2 size-4" />
                Ajouter une ligne
              </Button>
            }
          />
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Disponible à l&apos;origine</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell className="min-w-48">
                        <Controller
                          control={control}
                          name={`items.${index}.variantId`}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choisir">
                                  {(v: string) => variantLabels[v] ?? "Choisir"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {variants.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <StockHint
                          control={control}
                          index={index}
                          fromBoutiqueId={fromBoutiqueId}
                          stockMap={stockMap}
                        />
                      </TableCell>
                      <TableCell>
                        <QuantityField
                          control={control}
                          register={register}
                          errors={errors}
                          index={index}
                          fromBoutiqueId={fromBoutiqueId}
                          stockMap={stockMap}
                        />
                      </TableCell>
                      <TableCell>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          Créer le transfert
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </form>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!isSubmitting}>
          <DialogHeader>
            <DialogTitle>Confirmer le transfert</DialogTitle>
            <DialogDescription>Vérifiez les informations avant de valider.</DialogDescription>
          </DialogHeader>
          {pendingValues && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm font-semibold">
                <span className="truncate">{boutiqueLabels[pendingValues.fromBoutiqueId]}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{boutiqueLabels[pendingValues.toBoutiqueId]}</span>
              </div>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg border p-3">
                {confirmItems.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 border-b pb-1.5 text-sm last:border-b-0 last:pb-0"
                  >
                    <span className="truncate text-muted-foreground">{item.label}</span>
                    <span className="font-figures shrink-0 font-semibold tabular-nums">
                      {item.qty}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {confirmItems.length} référence{confirmItems.length > 1 ? "s" : ""}
                </span>
                <span className="font-figures font-bold tabular-nums">
                  {confirmTotalQty} article{confirmTotalQty > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setConfirmOpen(false)}
            >
              Non
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={handleConfirm}>
              {isSubmitting ? "Confirmation..." : "Oui"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="h-fit lg:sticky lg:top-4">
        <SectionHeader
          icon={Boxes}
          title={fromBoutiqueId ? boutiqueLabels[fromBoutiqueId] : "Stock de l'origine"}
          description={fromBoutiqueId ? "Disponible avant transfert" : undefined}
        />
        <CardContent>
          {!fromBoutiqueId ? (
            <p className="text-xs text-muted-foreground">
              Choisissez une boutique d&apos;origine pour voir son stock disponible.
            </p>
          ) : originStockList.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun stock disponible dans cette boutique.
            </p>
          ) : (
            <>
              <ul className="max-h-[360px] space-y-1.5 overflow-y-auto">
                {originStockList.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-2 border-b pb-1.5 text-sm last:border-b-0 last:pb-0"
                  >
                    <span className="truncate text-muted-foreground">{item.label}</span>
                    <span className="font-figures shrink-0 tabular-nums text-violet-600 dark:text-violet-400">
                      {item.qty}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">
                  {originStockList.length} référence{originStockList.length > 1 ? "s" : ""}
                </span>
                <span className="font-figures font-bold tabular-nums">
                  {originTotalQty} article{originTotalQty > 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
