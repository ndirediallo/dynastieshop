"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
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
import { factoryReset } from "./factory-reset-actions";
import { RESET_CONFIRMATION_PHRASE } from "./factory-reset-constants";

// Action la plus destructrice de toute l'application — pas de corbeille,
// pas d'annulation possible. Exige de taper la phrase exacte, pas juste un
// clic sur "Confirmer", pour qu'elle ne puisse jamais se déclencher par
// erreur (voir discussion : remise à zéro avant de livrer à une cliente).
export function FactoryResetDialog() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canConfirm = phrase === RESET_CONFIRMATION_PHRASE;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await factoryReset(phrase);
      toast.success("Données réinitialisées. Reconnectez-vous avec le mot de passe par défaut (0000).");
      // Comme pour le changement de mot de passe forcé : la session en
      // cours garde en cache l'ancien état (boutiqueId, mustChangePassword)
      // tant qu'un nouveau jeton n'est pas émis. Le plus sûr après une
      // réinitialisation complète est une reconnexion propre, pas une
      // tentative de rafraîchir la session en place.
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPhrase("");
      }}
    >
      <DialogTrigger render={<Button type="button" variant="destructive" />}>
        <Trash2 className="mr-2 size-4" />
        Réinitialisation complète
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Tout effacer avant la mise en ligne ?
          </DialogTitle>
          <DialogDescription render={<div className="space-y-3 text-sm" />}>
            <p>
              Cette action supprime <strong>définitivement</strong> et sans retour
              possible :
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Tous les produits, catégories et stocks</li>
              <li>Toutes les ventes, retours et paiements</li>
              <li>Tous les clients et fournisseurs</li>
              <li>Toutes les commandes fournisseurs et dépenses</li>
              <li>Tous les transferts et demandes de réapprovisionnement</li>
              <li>Toutes les boutiques et l&apos;entrepôt</li>
              <li>
                Tous les comptes utilisateurs, sauf le vôtre (remis au mot de
                passe par défaut 0000, à changer à la reconnexion)
              </li>
            </ul>
            <p>
              Les coordonnées de l&apos;entreprise (Paramètres) sont conservées.
              Pour confirmer, tapez exactement :{" "}
              <span className="font-mono font-bold text-foreground">
                {RESET_CONFIRMATION_PHRASE}
              </span>
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-phrase" className="sr-only">
            Phrase de confirmation
          </Label>
          <Input
            id="confirm-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={RESET_CONFIRMATION_PHRASE}
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "Réinitialisation..." : "Tout effacer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
