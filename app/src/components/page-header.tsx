import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Pastille d'icône colorée à côté du titre de page — présente sur chaque
// écran pour donner un repère visuel immédiat au module (inspiré des
// références partagées par l'utilisateur : chaque page a sa propre icône
// et sa propre couleur, pas juste du texte).
const TINTS = {
  pink: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  green: "bg-emerald-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-violet-500 text-white",
  slate: "bg-slate-700 text-white dark:bg-slate-600",
} as const;

export function PageHeader({
  icon: Icon,
  title,
  description,
  tint = "pink",
  actions,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  tint?: keyof typeof TINTS;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            TINTS[tint]
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
