"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pour une page accessible depuis plusieurs endroits (ex. le détail d'une
// commande, ouvert depuis la liste des commandes OU depuis "À traiter" sur
// le tableau de bord) — un lien fixe se trompe forcément une fois sur deux.
// `router.back()` ramène réellement là d'où l'utilisateur vient.
export function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-primary/30 bg-primary/5 font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/10"
      onClick={() => router.back()}
    >
      <ArrowLeft className="mr-2 size-4" />
      {label}
    </Button>
  );
}
