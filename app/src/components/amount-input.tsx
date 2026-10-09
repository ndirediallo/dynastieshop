"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Champ montant avec séparateur de milliers affiché en temps réel pendant
// la saisie (20 000 000 au lieu de 20000000) — pour qu'on puisse vérifier
// le nombre de zéros d'un coup d'œil avant de valider, plutôt que de se fier
// à un bloc de chiffres collés où une erreur d'un zéro passe inaperçue.
// La valeur exposée au parent reste une chaîne de chiffres bruts (ex.
// "20000000"), donc aucun changement ailleurs dans les calculs/l'envoi au
// serveur — seul l'affichage pendant la frappe change.
export function AmountInput({
  value,
  onValueChange,
  className,
  ...props
}: {
  value: string;
  onValueChange: (digits: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const digitsOnly = value.replace(/[^\d]/g, "");
  const formatted = digitsOnly ? Number(digitsOnly).toLocaleString() : "";

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn("font-figures tabular-nums", className)}
      value={formatted}
      onChange={(e) => onValueChange(e.target.value.replace(/[^\d]/g, ""))}
    />
  );
}
