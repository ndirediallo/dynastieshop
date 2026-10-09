import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { can } from "@/lib/permissions";
import { GUIDE_MODULES } from "@/lib/guide-content";

// Accessible à tout compte connecté (pas de module requis), mais chaque
// module n'apparaît que si le rôle (ou un accès supplémentaire) y donne
// droit — même filtrage que le menu de gauche, pour qu'un Caissier ne
// tombe jamais sur un guide d'une fonctionnalité qu'il ne peut pas utiliser.
export default async function GuidePage() {
  const session = await auth();
  const role = session!.user.role;
  const extra = session!.user.extraModules ?? [];

  const visibleModules = GUIDE_MODULES.filter((m) => can(role, m.key, extra));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Guide d'utilisation"
        description="Explications pas à pas, avec captures d'écran, pour chaque fonctionnalité"
        tint="blue"
      />

      {visibleModules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun guide disponible pour votre compte pour le moment.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((m) => (
            <Link key={m.key} href={`/guide/${m.key}`}>
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-primary/5">
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div>
                    <h3 className="font-bold">{m.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {m.topics.length} sujet{m.topics.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
