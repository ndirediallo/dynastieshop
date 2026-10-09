"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { deletePurchaseOrder } from "../actions";

export function PurchaseOrderDeleteButton({
  id,
  reference,
  small = false,
  redirectTo,
}: {
  id: string;
  reference: string;
  small?: boolean;
  // Depuis la page détail, la commande qu'on vient de supprimer n'existe
  // plus : un simple refresh() ferait planter la page sur un 404 au lieu
  // de ramener l'utilisateur à la liste.
  redirectTo?: string;
}) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      trigger={
        small ? (
          <Trash2 className="size-4" />
        ) : (
          <>
            <Trash2 className="mr-2 size-4" />
            Supprimer
          </>
        )
      }
      triggerVariant={small ? "ghost" : "outline"}
      triggerSize={small ? "icon" : "default"}
      title={`Supprimer la commande ${reference} ?`}
      description="Rien n'ayant été reçu, aucun stock ni paiement n'est affecté. Contrairement à l'annulation, cette action efface la commande définitivement : impossible de revenir en arrière."
      confirmLabel="Supprimer définitivement"
      pendingLabel="Suppression..."
      confirmVariant="destructive"
      successMessage="Commande supprimée"
      onConfirm={async () => {
        const result = await deletePurchaseOrder(id);
        if (!("error" in result)) {
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        }
        return result;
      }}
    />
  );
}
