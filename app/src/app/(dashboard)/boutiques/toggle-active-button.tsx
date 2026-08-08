"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleBoutiqueActive } from "./actions";

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
        await toggleBoutiqueActive(id, checked);
        toast.success(checked ? "Boutique activée" : "Boutique désactivée");
      } catch {
        toast.error("Une erreur est survenue. Réessayez.");
      }
    });
  };

  return <Switch checked={active} disabled={isPending} onCheckedChange={onChange} />;
}
