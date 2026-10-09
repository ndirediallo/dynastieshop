"use client";

import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { resolveSaleEditRequest } from "../actions";

export function ResolveSaleEditRequestButtons({ id }: { id: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-2">
      <ConfirmActionButton
        trigger={
          <>
            <Check className="mr-1.5 size-3.5" />
            Approuver
          </>
        }
        triggerSize="sm"
        title="Approuver cette demande de correction ?"
        description="Cela ne corrige rien automatiquement. Utilisez ensuite le bouton « Retourner / Rembourser » pour effectuer la correction vous-même."
        confirmLabel="Approuver"
        pendingLabel="..."
        successMessage="Demande approuvée"
        onConfirm={async () => {
          const result = await resolveSaleEditRequest(id, true);
          if (!("error" in result)) router.refresh();
          return result;
        }}
      />
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
        description="Le Caissier verra que sa demande a été refusée."
        confirmLabel="Rejeter"
        pendingLabel="..."
        confirmVariant="destructive"
        successMessage="Demande rejetée"
        onConfirm={async () => {
          const result = await resolveSaleEditRequest(id, false);
          if (!("error" in result)) router.refresh();
          return result;
        }}
      />
    </div>
  );
}
