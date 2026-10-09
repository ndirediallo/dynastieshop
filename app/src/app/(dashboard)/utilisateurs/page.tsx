import Link from "next/link";
import { UserCog, Phone, Store, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { UserDialog } from "./user-dialog";
import { ToggleActiveButton } from "./toggle-active-button";
import { cn } from "@/lib/utils";

const ROLE_TINTS: Record<string, { bg: string; fg: string }> = {
  SUPER_ADMIN: { bg: "bg-primary/10", fg: "text-primary" },
  CAISSIER: { bg: "bg-blue-500/10", fg: "text-blue-600 dark:text-blue-400" },
  LOGISTIQUE: { bg: "bg-amber-500/10", fg: "text-amber-600 dark:text-amber-400" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function UtilisateursPage() {
  const [users, boutiques] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { boutique: { select: { name: true } } },
    }),
    prisma.boutique.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCog}
        title="Utilisateurs"
        description="Gérez les comptes et les rôles des utilisateurs"
        tint="slate"
        actions={<UserDialog boutiques={boutiques} />}
      />

      <p className="text-sm font-medium text-muted-foreground">
        {users.length} utilisateur{users.length > 1 ? "s" : ""}
      </p>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
          <UserCog className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun utilisateur enregistré pour le moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => {
            const tint = ROLE_TINTS[user.role] ?? ROLE_TINTS.CAISSIER;
            const isLocked = user.lockedUntil && user.lockedUntil > new Date();

            return (
              <div
                key={user.id}
                className="flex flex-col gap-3.5 rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold",
                        tint.bg,
                        tint.fg
                      )}
                    >
                      {initials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold leading-tight">{user.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" />
                        {user.phone}
                      </p>
                    </div>
                  </div>
                  <UserDialog
                    boutiques={boutiques}
                    user={{
                      id: user.id,
                      name: user.name,
                      phone: user.phone,
                      role: user.role,
                      boutiqueId: user.boutiqueId,
                      extraModules: user.extraModules,
                    }}
                  />
                </div>

                <div className="h-px bg-border" />

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn("font-semibold", tint.fg)}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                  <Badge variant={user.active ? "success" : "secondary"}>
                    {user.active ? "Actif" : "Désactivé"}
                  </Badge>
                  {isLocked && <Badge variant="destructive">Bloqué (échecs)</Badge>}
                  {user.extraModules.length > 0 && (
                    <Badge variant="secondary">
                      +{user.extraModules.length} accès
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Store className="size-3.5 shrink-0" />
                    {user.boutique?.name ?? "Aucune boutique assignée"}
                  </div>
                  <ToggleActiveButton id={user.id} active={user.active} />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-between"
                  nativeButton={false}
                  render={<Link href={`/utilisateurs/${user.id}`} />}
                >
                  Voir le profil et l&apos;activité
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
