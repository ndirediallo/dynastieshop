import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Déplacé dans (dashboard) (au lieu d'une page nue hors layout) pour que la
// barre latérale et l'en-tête restent visibles derrière — voir discussion
// avec l'utilisateur : une redirection vers une page vide donnait
// l'impression de quitter l'application, une carte centrée façon popup est
// moins déroutante, surtout en cas de clic accidentel sur un lien.
export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-lg ring-1 ring-foreground/5">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-lg font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre rôle ne vous permet pas d&apos;accéder à cette page. Si vous pensez qu&apos;il
          s&apos;agit d&apos;une erreur, rapprochez-vous de votre administrateur.
        </p>
        <Button className="mt-5 w-full" nativeButton={false} render={<Link href="/dashboard" />}>
          Retourner au tableau de bord
        </Button>
      </div>
    </div>
  );
}
