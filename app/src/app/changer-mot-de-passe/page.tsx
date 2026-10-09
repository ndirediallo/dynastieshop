import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Choisir un mot de passe · DYNASTIE SHOP",
};

export const dynamic = "force-dynamic";

export default async function ChangerMotDePassePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const settings = await getSettings();

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {settings.logoUrl ? (
            <Image
              src={settings.logoUrl}
              alt={settings.companyName}
              width={64}
              height={64}
              className="mb-3 size-16 object-contain"
              priority
            />
          ) : (
            <div className="mb-3 flex size-16 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              {settings.companyName.slice(0, 1)}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {settings.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">Bonjour {session.user.name}</p>
        </div>
        <ChangePasswordForm phone={session.user.phone} />
      </div>
    </div>
  );
}
