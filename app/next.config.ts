import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js limite par défaut une Server Action à 1 Mo. Relevé à 4 Mo —
  // pas plus : Vercel impose de son côté un plafond d'environ 4,5 Mo sur le
  // corps d'une requête de fonction serverless, impossible à changer ici,
  // donc inutile de viser plus haut. La vraie protection contre les photos
  // de téléphone (souvent 3-12 Mo) est le redimensionnement côté
  // navigateur avant envoi (voir src/lib/resize-image.ts) — cette limite
  // n'est qu'un filet de sécurité derrière.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
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
