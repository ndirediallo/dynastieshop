import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { BarChart3, Boxes, ShoppingCart, Store } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion · DYNASTIE SHOP",
};

// La page lit les Paramètres (logo, nom) en base à chaque requête : sans
// cela, Next la prérendrait une fois pour toutes au build et figerait le
// branding affiché (logo/nom obsolètes après une modification).
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Store, label: "Plusieurs boutiques, une seule vue d'ensemble" },
  { icon: ShoppingCart, label: "Caisse et historique des ventes en temps réel" },
  { icon: Boxes, label: "Stock, transferts et alertes de rupture" },
  { icon: BarChart3, label: "Rapports et chiffre d'affaires, à jour chaque jour" },
];

export default async function LoginPage() {
  const settings = await getSettings();

  return (
    <div className="flex min-h-svh w-full bg-background">
      {/* Panneau de marque — masqué sur mobile pour laisser toute la place
          au formulaire, qui est l'usage réel en boutique (connexion depuis
          un téléphone au comptoir, pas depuis un poste fixe). */}
      <div className="relative hidden w-[44%] shrink-0 overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12 xl:w-[38%]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1.5px 1.5px, white 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative">
          <span className="text-2xl font-extrabold tracking-tight text-white xl:text-3xl">
            {settings.companyName}
          </span>
        </div>

        <div className="relative space-y-8">
          <h2 className="text-3xl font-bold leading-tight text-balance text-white xl:text-4xl">
            La gestion de vos boutiques, simplifiée.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4.5 text-white" />
                </span>
                <span className="text-sm font-medium text-white/90">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Système de gestion commerciale, usage interne.
        </p>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            {settings.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.companyName}
                width={112}
                height={112}
                className="mb-4 size-28 object-contain"
                priority
              />
            ) : (
              <div className="mb-4 flex size-28 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
                {settings.companyName.slice(0, 1)}
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight">Bon retour</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connectez-vous avec votre numéro de téléphone et votre mot de passe.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
