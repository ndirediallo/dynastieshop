"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateStockTransfer, cancelStockTransfer } from "./actions";

interface TransferItem {
  label: string;
  quantity: number;
}

export function TransferActions({
  id,
  fromBoutique,
  toBoutique,
  items,
}: {
  id: string;
  fromBoutique: string;
  toBoutique: string;
  items: TransferItem[];
}) {
  const router = useRouter();
  const [cancelReason, setCancelReason] = useState("");

  return (
    <div className="flex gap-2">
      <ConfirmActionButton
        trigger={
          <>
            <Check className="mr-2 size-4" />
            Confirmer la réception
          </>
        }
        title="Confirmer la réception du transfert"
        description={`Le stock sera déplacé de ${fromBoutique} vers ${toBoutique}. Cette action met à jour le stock des deux emplacements.`}
        confirmLabel="Confirmer la réception"
        pendingLabel="Validation..."
        successMessage="Transfert validé, stock mis à jour dans les deux boutiques"
        onConfirm={async () => {
          const result = await validateStockTransfer(id);
          if (!("error" in result)) router.refresh();
          return result;
        }}
      >
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="font-medium">{item.label}</span>
              <span className="font-figures font-bold tabular-nums">{item.quantity}</span>
            </div>
          ))}
        </div>
      </ConfirmActionButton>

      <ConfirmActionButton
        trigger={
          <>
            <X className="mr-2 size-4" />
            Annuler
          </>
        }
        triggerVariant="outline"
        title="Annuler ce transfert ?"
        description="Le transfert ne sera pas effectué et le stock ne bougera pas. Cette action est définitive."
        confirmLabel="Annuler le transfert"
        pendingLabel="Annulation..."
        confirmVariant="destructive"
        successMessage="Transfert annulé"
        onConfirm={async () => {
          const result = await cancelStockTransfer(id, cancelReason);
          if (!("error" in result)) {
            setCancelReason("");
            router.refresh();
          }
          return result;
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" className="text-xs text-muted-foreground">
            Motif (optionnel)
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder="Ex : erreur de saisie, produit finalement indisponible..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
          />
        </div>
      </ConfirmActionButton>
    </div>
  );
}
