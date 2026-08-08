"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleProductActive } from "./actions";

export function ToggleActiveButton({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const onChange = (checked: boolean) => {
    startTransition(async () => {
      try {
        await toggleProductActive(id, checked);
        toast.success(checked ? "Produit activé" : "Produit désactivé");
      } catch {
        toast.error("Une erreur est survenue. Réessayez.");
      }
    });
  };

  return (
    <Switch checked={active} disabled={isPending} onCheckedChange={onChange} />
  );
}
