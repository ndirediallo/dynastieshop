"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logFixedExpense } from "./actions";

export function LogFixedExpenseButton({ id }: { id: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      disabled={isSubmitting}
      onClick={async () => {
        setIsSubmitting(true);
        try {
          await logFixedExpense(id, new Date().toISOString().slice(0, 10));
          toast.success("Dépense enregistrée pour ce mois");
        } catch {
          toast.error("Une erreur est survenue. Réessayez.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      {isSubmitting ? (
        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
      ) : (
        <Check className="mr-1.5 size-3.5" />
      )}
      Enregistrer ce mois
    </Button>
  );
}
