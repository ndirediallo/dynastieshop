import type { MetadataRoute } from "next";

// Permet "Ajouter à l'écran d'accueil" sur téléphone (Android surtout -
// iOS/Safari ignore ce fichier et se base sur les balises apple-* du
// <head>, voir layout.tsx) : une fois ajoutée, l'icône ouvre l'app en plein
// écran, sans barre d'adresse, comme une vraie application installée.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DYNASTIE SHOP · Gestion Commerciale",
    short_name: "Dynastie Shop",
    description: "Système de gestion commerciale DYNASTIE SHOP",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fdfdfd",
    theme_color: "#e0257a",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
