import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Police plus ronde/géométrique, dans l'esprit des captures de référence
// (Angadi) — remplace Geist, jugée trop proche de l'apparence d'origine.
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Police dédiée aux chiffres mis en avant (tableau de bord, SKU...).
// Remplace Geist Mono : son "0" barré par défaut n'est pas un réglage
// désactivable (pas une variante OpenType, juste le dessin de base du
// glyphe) — confirmé après un premier correctif CSS resté sans effet sur
// deux navigateurs différents. Inter a un zéro plein, pas de piège de ce
// genre, tout en gardant des chiffres tabulaires bien alignés.
const numeric = Inter({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DYNASTIE SHOP · Gestion Commerciale",
  description: "Système de gestion commerciale DYNASTIE SHOP",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  // "Ajouter à l'écran d'accueil" depuis Safari iOS : sans ces balises,
  // l'app s'ouvre quand même mais dans Safari (barre d'adresse visible) au
  // lieu d'une fenêtre plein écran façon application installée.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dynastie Shop",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e0257a" },
    { media: "(prefers-color-scheme: dark)", color: "#ec4899" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${numeric.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
