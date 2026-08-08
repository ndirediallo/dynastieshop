import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { Sidebar } from "@/components/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const settings = await getSettings();

  return (
    <div className="flex min-h-svh w-full">
      <Sidebar
        role={session.user.role}
        logoUrl={settings.logoUrl}
        companyName={settings.companyName}
      />
      <div className="flex flex-1 flex-col">
        <DashboardHeader user={session.user} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
