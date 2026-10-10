import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { Sidebar } from "@/components/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { IdleWatcher } from "@/components/idle-watcher";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const [settings, boutiques] = await Promise.all([
    getSettings(),
    prisma.boutique.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-svh w-full">
      <IdleWatcher
        idleTimeoutMinutes={settings.idleTimeoutMinutes}
        idleTimeoutMode={settings.idleTimeoutMode}
        userName={session.user.name ?? ""}
      />
      <Sidebar
        role={session.user.role}
        extraModules={session.user.extraModules}
        logoUrl={settings.logoUrl}
        companyName={settings.companyName}
        boutiques={boutiques}
      />
      {/* min-w-0 sur les deux niveaux : un enfant flex refuse par défaut de
          rétrécir sous la largeur de son contenu (min-width: auto), donc un
          tableau large quelque part dans {children} forçait toute cette
          colonne — et avec elle toute la page, barre latérale comprise — à
          dépasser la largeur de l'écran sur mobile (bug repéré en testant
          l'app sur téléphone, voir aussi le <div className="overflow-x-auto">
          déjà posé autour de chaque <Table> : il ne servait à rien tant que
          ce point-ci n'était pas corrigé, le parent s'élargissait avant que
          le tableau n'ait besoin de défiler). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          user={session.user}
          logoUrl={settings.logoUrl}
          companyName={settings.companyName}
          boutiques={boutiques}
        />
        <main className="min-w-0 flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
