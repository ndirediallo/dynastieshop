"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelPurchaseOrder } from "../../actions";

export function PurchaseOrderActions({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [cancelReason, setCancelReason] = useState("");

  return (
    <ConfirmActionButton
      trigger={
        <>
          <X className="mr-2 size-4" />
          Annuler la commande
        </>
      }
      triggerVariant="outline"
      title={`Annuler la commande ${reference} ?`}
      description="Rien n'ayant encore été reçu, aucun stock ni paiement ne sera affecté. Cette action est définitive."
      confirmLabel="Annuler la commande"
      pendingLabel="Annulation..."
      confirmVariant="destructive"
      successMessage="Commande annulée"
      onConfirm={async () => {
        const result = await cancelPurchaseOrder(id, cancelReason);
        if (!("error" in result)) {
          setCancelReason("");
          router.refresh();
        }
        return result;
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cancel-po-reason" className="text-xs text-muted-foreground">
          Motif (optionnel)
        </Label>
        <Textarea
          id="cancel-po-reason"
          placeholder="Ex : erreur de saisie, fournisseur finalement indisponible..."
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={2}
        />
      </div>
    </ConfirmActionButton>
  );
}
