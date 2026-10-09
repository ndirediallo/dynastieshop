"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fulfillRestockRequest, rejectRestockRequest } from "./actions";

// Ravitaille en un clic : pas de détour par "Nouveau transfert" (voir
// discussion avec l'utilisateur — ce détour manuel était trop lent). Un
// seul geste crée ET valide le transfert, le stock bouge immédiatement.
export function RestockRequestActions({
  id,
  defaultQuantity,
}: {
  id: string;
  defaultQuantity: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(defaultQuantity ?? 1));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFulfill = async () => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Indiquez une quantité valide.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await fulfillRestockRequest(id, qty);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Boutique ravitaillée, transfert ${result.data.transferReference} validé`);
      setOpen(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex shrink-0 gap-1.5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" />}>
          <Truck className="mr-1.5 size-3.5" />
          Ravitailler
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ravitailler cette boutique</DialogTitle>
            <DialogDescription>
              Un transfert est créé et validé automatiquement : le stock de l&apos;entrepôt
              diminue, celui de la boutique augmente, tout de suite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fulfill-quantity">Quantité à transférer</Label>
            <Input
              id="fulfill-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button disabled={isSubmitting} onClick={handleFulfill}>
              {isSubmitting ? "Ravitaillement..." : "Ravitailler maintenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionButton
        trigger={
          <>
            <X className="mr-1.5 size-3.5" />
            Rejeter
          </>
        }
        triggerVariant="outline"
        triggerSize="sm"
        title="Rejeter cette demande ?"
        description="La boutique saura que sa demande n'a pas été retenue. Aucun stock ne bouge."
        confirmLabel="Rejeter"
        pendingLabel="..."
        confirmVariant="destructive"
        successMessage="Demande rejetée"
        onConfirm={async () => {
          const result = await rejectRestockRequest(id);
          if (!("error" in result)) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
