import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="size-12 text-destructive" />
      <h1 className="text-xl font-semibold">Accès refusé</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Votre rôle ne vous permet pas d&apos;accéder à cette page. Contactez
        votre administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une
        erreur.
      </p>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        Retour au tableau de bord
      </Button>
    </div>
  );
}
