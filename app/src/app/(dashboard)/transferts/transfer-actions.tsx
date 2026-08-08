"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateStockTransfer, cancelStockTransfer } from "./actions";

export function TransferActions({ id }: { id: string }) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const onValidate = async () => {
    setIsValidating(true);
    try {
      const result = await validateStockTransfer(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfert validé, stock mis à jour dans les deux boutiques");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsValidating(false);
    }
  };

  const onCancel = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelStockTransfer(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfert annulé");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={onValidate} disabled={isValidating || isCancelling}>
        <Check className="mr-2 size-4" />
        {isValidating ? "Validation..." : "Confirmer la réception"}
      </Button>
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={isValidating || isCancelling}
      >
        <X className="mr-2 size-4" />
        Annuler
      </Button>
    </div>
  );
}
