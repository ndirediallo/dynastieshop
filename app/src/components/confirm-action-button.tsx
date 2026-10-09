"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ActionResult = { error: string } | { success: true } | void;

// Bouton générique "agir après confirmation" : pour toute action qui
// modifie réellement le stock ou les finances (validation/annulation de
// transfert, réception de commande...) et qu'on ne peut pas simplement
// "re-cliquer pour annuler" comme un toggle actif/inactif.
export function ConfirmActionButton({
  trigger,
  triggerVariant = "default",
  triggerSize = "default",
  disabled,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  confirmVariant = "default",
  successMessage,
  onConfirm,
}: {
  trigger: ReactNode;
  triggerVariant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  triggerSize?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  confirmVariant?: "default" | "outline" | "destructive" | "ghost" | "secondary";
  successMessage: string;
  onConfirm: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const result = await onConfirm();
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant={triggerVariant} size={triggerSize} disabled={disabled} />
        }
      >
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button variant={confirmVariant} disabled={isSubmitting} onClick={handleConfirm}>
            {isSubmitting ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
