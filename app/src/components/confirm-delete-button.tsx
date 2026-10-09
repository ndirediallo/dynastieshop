"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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

type DeleteResult = { error: string } | { success: true } | void;

// Bouton de suppression réutilisable : ouvre une confirmation avant
// d'agir, et affiche le message d'erreur du serveur si la suppression est
// refusée (ex. élément encore utilisé ailleurs) plutôt que d'échouer en
// silence.
export function ConfirmDeleteButton({
  onConfirm,
  title,
  description,
  size = "icon",
  variant = "ghost",
  label,
}: {
  onConfirm: () => Promise<DeleteResult>;
  title: string;
  description: string;
  size?: "icon" | "icon-sm" | "sm" | "default";
  variant?: "ghost" | "outline" | "destructive";
  label?: string;
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
      toast.success("Supprimé avec succès");
      setOpen(false);
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={variant} size={size} />}>
        <Trash2 className="size-4" />
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" disabled={isSubmitting} onClick={handleConfirm}>
            {isSubmitting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
