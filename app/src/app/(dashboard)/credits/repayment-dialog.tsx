"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { creditRepaymentSchema, type CreditRepaymentInput } from "@/lib/schemas";
import { PAYMENT_METHOD_LABELS, type PaymentMethodValue } from "@/lib/payment-methods";
import { recordCreditRepayment } from "./actions";

export function RepaymentDialog({
  saleId,
  balance,
  currency,
  small = false,
  activeMethods = Object.keys(PAYMENT_METHOD_LABELS),
}: {
  saleId: string;
  balance: number;
  currency: string;
  small?: boolean;
  // Paramètres → Méthodes de paiement actives — par défaut toutes, pour ne
  // jamais casser un appelant qui ne passe pas (encore) cette prop.
  activeMethods?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const methodEntries = (
    Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethodValue, string][]
  ).filter(([value]) => activeMethods.includes(value));
  const defaultMethod: PaymentMethodValue = methodEntries[0]?.[0] ?? "ESPECES";

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreditRepaymentInput>({
    resolver: zodResolver(creditRepaymentSchema),
    defaultValues: { method: defaultMethod, amount: balance },
  });

  const onSubmit = async (values: CreditRepaymentInput) => {
    setIsSubmitting(true);
    try {
      const result = await recordCreditRepayment(saleId, values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Remboursement enregistré");
      reset({ method: defaultMethod, amount: 0 });
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ method: defaultMethod, amount: balance });
      }}
    >
      <DialogTrigger render={<Button size={small ? "sm" : "default"} variant={small ? "outline" : "default"} />}>
        <HandCoins className="mr-2 size-4" />
        Enregistrer un remboursement
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer un remboursement</DialogTitle>
          <DialogDescription>
            Solde restant dû : {balance.toLocaleString()} {currency}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Méthode</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Méthode">
                      {(v: string) => PAYMENT_METHOD_LABELS[v as PaymentMethodValue] ?? "Méthode"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {methodEntries.map(([value, label]) => (
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
            <Label htmlFor="amount">Montant reçu ({currency})</Label>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <AmountInput
                  id="amount"
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(digits) => field.onChange(digits ? Number(digits) : 0)}
                />
              )}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
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
