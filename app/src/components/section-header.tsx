import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TINTS = {
  pink: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
} as const;

// En-tête de section réutilisable à l'intérieur d'une Card : pastille
// d'icône teintée + titre + sous-titre, séparée du contenu par une
// bordure — introduit sur Transferts (inspiré d'une référence partagée
// par l'utilisateur), pensé pour être réutilisé lors de la passe de
// design globale sur le reste de l'app.
export function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
  tint = "purple",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  tint?: keyof typeof TINTS;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-(--card-spacing) pb-(--card-spacing)">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          TINTS[tint]
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold leading-snug">{title}</p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
