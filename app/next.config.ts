import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js limite par défaut une Server Action à 1 Mo — en-dessous d'une
  // vraie photo prise au téléphone (logo, photo produit). Au-delà, la
  // requête est rejetée avant même d'atteindre notre code, d'où l'échec
  // silencieux signalé par l'utilisateur malgré le correctif de lenteur
  // précédent (un problème distinct, pas le même bug).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Logo et photos produits sont servis depuis Supabase Storage (voir
    // src/lib/supabase-storage.ts) plutôt que depuis /public — next/image
    // refuse par défaut d'optimiser une image venant d'un domaine externe
    // non listé ici.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
