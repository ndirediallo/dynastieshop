import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — DYNASTIE SHOP",
};

// La page lit les Paramètres (logo, nom) en base à chaque requête : sans
// cela, Next la prérendrait une fois pour toutes au build et figerait le
// branding affiché (logo/nom obsolètes après une modification).
export const dynamic = "force-dynamic";

export default async function LoginPage() {
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
          <p className="text-sm text-muted-foreground">
            Système de gestion commerciale
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
