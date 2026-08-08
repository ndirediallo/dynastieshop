"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
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
import { createReturn } from "../actions";

interface ReturnableItem {
  saleItemId: string;
  label: string;
  quantity: number;
  alreadyReturned: number;
}

export function ReturnDialog({
  saleId,
  items,
}: {
  saleId: string;
  items: ReturnableItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const returnable = items.filter((i) => i.alreadyReturned < i.quantity);

  const onSubmit = async () => {
    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    if (lines.length === 0) {
      toast.error("Indiquez une quantité à retourner pour au moins un article.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createReturn({ saleId, reason, items: lines });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Retour enregistré avec succès");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (returnable.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Undo2 className="mr-2 size-4" />
        Enregistrer un retour
      </DialogTrigger>
      <DialogContent>
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
          <div className="space-y-2">
            <Label htmlFor="reason">Motif (optionnel)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Confirmer le retour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
