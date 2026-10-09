import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
