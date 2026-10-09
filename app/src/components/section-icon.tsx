import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

// Pastille d'icône colorée à côté d'un titre de section (carte, bloc de
// liste...) — texte neutre, juste l'icône en couleur, assez grande pour
// être repérable d'un coup d'œil sans surcharger la page de couleur.
const TINTS = {
  pink: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  green: "bg-emerald-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-violet-500 text-white",
  // Pour les sections purement informatives, sans signification
  // particulière (ni alerte, ni action recommandée) — réserve le rose/les
  // autres teintes aux cas qui portent vraiment un sens (voir dashboard,
  // passe de design : trop de couleurs différentes sans raison diluent
  // l'attention au lieu de la guider).
  slate: "bg-slate-600 text-white dark:bg-slate-500",
} as const;

export function SectionIcon({
  icon: Icon,
  tint,
}: {
  icon: ComponentType<{ className?: string }>;
  tint: keyof typeof TINTS;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm",
        TINTS[tint]
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
