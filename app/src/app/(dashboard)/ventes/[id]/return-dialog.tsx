"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Undo2,
  Banknote,
  Smartphone,
  Waves,
  CreditCard,
  Landmark,
  Receipt,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { createReturn } from "../actions";

interface ReturnableItem {
  saleItemId: string;
  label: string;
  quantity: number;
  alreadyReturned: number;
  netUnitPrice: number;
}

const REFUND_OPTIONS = [
  { value: "ESPECES", label: "Espèces", icon: Banknote },
  { value: "ORANGE_MONEY", label: "Orange Money", icon: Smartphone },
  { value: "MTN_MONEY", label: "MTN Mobile Money", icon: Smartphone },
  { value: "WAVE", label: "Wave", icon: Waves },
  { value: "CARTE", label: "Carte Bancaire", icon: CreditCard },
  { value: "VIREMENT", label: "Virement", icon: Landmark },
] as const;

type RefundMethodValue = (typeof REFUND_OPTIONS)[number]["value"];

export function ReturnDialog({
  saleId,
  items,
  currency,
}: {
  saleId: string;
  items: ReturnableItem[];
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "refund">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [asStoreCredit, setAsStoreCredit] = useState(false);
  const [refundMethod, setRefundMethod] = useState<RefundMethodValue | null>(null);

  const returnable = items.filter((i) => i.alreadyReturned < i.quantity);
  const linesToReturn = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([saleItemId, quantity]) => {
      const item = items.find((i) => i.saleItemId === saleItemId)!;
      return { saleItemId, quantity, label: item.label, amount: item.netUnitPrice * quantity };
    });
  const refundAmount = linesToReturn.reduce((sum, l) => sum + l.amount, 0);

  const resetAll = () => {
    setReason("");
    setQuantities({});
    setAsStoreCredit(false);
    setRefundMethod(null);
    setStep("form");
  };

  const goToRefundStep = () => {
    if (linesToReturn.length === 0) {
      toast.error("Indiquez une quantité à retourner pour au moins un article.");
      return;
    }
    setStep("refund");
  };

  const onSubmit = async () => {
    if (!asStoreCredit && !refundMethod) {
      toast.error("Choisissez un moyen de remboursement, ou optez pour un avoir.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createReturn({
        saleId,
        reason,
        items: linesToReturn.map(({ saleItemId, quantity }) => ({ saleItemId, quantity })),
        asStoreCredit,
        refundMethod: asStoreCredit ? null : refundMethod,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Retour enregistré avec succès");
      setOpen(false);
      resetAll();
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (returnable.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Undo2 className="mr-2 size-4" />
        Enregistrer un retour
      </DialogTrigger>
      <DialogContent>
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Retour d&apos;articles</DialogTitle>
              <DialogDescription>
                La quantité retournée est remise en stock automatiquement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {returnable.map((item) => {
                const maxReturnable = item.quantity - item.alreadyReturned;
                return (
                  <div
                    key={item.saleItemId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {maxReturnable} sur {item.quantity} retournable(s)
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={maxReturnable}
                      className="w-20"
                      value={quantities[item.saleItemId] ?? 0}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.saleItemId]: Math.min(
                            Number(e.target.value) || 0,
                            maxReturnable
                          ),
                        }))
                      }
                    />
                  </div>
                );
              })}
              {refundAmount > 0 && (
                <p className="text-sm font-medium">
                  Montant à rembourser :{" "}
                  <span className="font-figures tabular-nums text-primary">
                    {refundAmount.toLocaleString()} {currency}
                  </span>
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="reason">Motif (optionnel)</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={goToRefundStep}>Continuer</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rembourser le client</DialogTitle>
              <DialogDescription>
                {linesToReturn.length} article{linesToReturn.length > 1 ? "s" : ""} à retourner.
                Cette action ajuste le stock et est enregistrée dans le journal d&apos;activité.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground">Montant à rembourser</p>
                <p className="font-figures mt-1 text-3xl font-bold tabular-nums text-primary">
                  {refundAmount.toLocaleString()} {currency}
                </p>
              </div>

              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2">
                {linesToReturn.map((l) => (
                  <div
                    key={l.saleItemId}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {l.label} × {l.quantity}
                    </span>
                    <span className="font-figures tabular-nums">
                      {l.amount.toLocaleString()} {currency}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Moyen de remboursement
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {REFUND_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAsStoreCredit(false);
                        setRefundMethod(value);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                        !asStoreCredit && refundMethod === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="size-5" />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAsStoreCredit(true);
                    setRefundMethod(null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    asStoreCredit
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Receipt className="size-4" />
                  Avoir (pas de remboursement immédiat)
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")}>
                Modifier
              </Button>
              <Button
                disabled={isSubmitting || (!asStoreCredit && !refundMethod)}
                onClick={onSubmit}
              >
                {isSubmitting ? "Enregistrement..." : "Confirmer le retour"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
