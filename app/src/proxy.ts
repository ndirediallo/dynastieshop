import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

// Modules réservés à certains rôles, contrôlés dès le middleware pour
// éviter tout accès direct par URL. La vérification fine par module côté
// page/server action (voir src/lib/permissions.ts) reste la référence.
const ROUTE_ROLES: Record<string, Role[]> = {
  "/boutiques": ["SUPER_ADMIN"],
  "/utilisateurs": ["SUPER_ADMIN"],
  "/journal": ["SUPER_ADMIN"],
  "/parametres": ["SUPER_ADMIN"],
};

const PUBLIC_PATHS = ["/login"];
const CHANGE_PASSWORD_PATH = "/changer-mot-de-passe";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublicPath = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  // Compte fraîchement créé (code par défaut "0000") ou réinitialisé par
  // le Super Admin : bloqué sur cette seule page tant qu'il n'a pas choisi
  // son propre code (voir auth.ts — le JWT est rafraîchi par un nouveau
  // signIn() à la fin de ce flux, pas par un simple aller-retour serveur).
  if (isLoggedIn && req.auth?.user?.mustChangePassword) {
    if (nextUrl.pathname !== CHANGE_PASSWORD_PATH) {
      return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, nextUrl.origin));
    }
    return NextResponse.next();
  }
  if (isLoggedIn && nextUrl.pathname === CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  if (isLoggedIn) {
    const restrictedPrefix = Object.keys(ROUTE_ROLES).find((prefix) =>
      nextUrl.pathname.startsWith(prefix)
    );
    if (restrictedPrefix) {
      const allowedRoles = ROUTE_ROLES[restrictedPrefix];
      const role = req.auth?.user?.role;
      if (!role || !allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL("/unauthorized", nextUrl.origin));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  // "uploads"/"icons"/"guide-assets" doivent rester publics : fichiers
  // statiques (logo, photos produits, icônes d'application, captures du
  // guide d'utilisation) servis depuis /public, y compris via l'optimiseur
  // d'images de Next.js qui les relit en interne sans cookie de session —
  // "guide-assets" est un dossier séparé de la page /guide elle-même
  // (toujours protégée) pour ne rendre public QUE les images, pas le
  // contenu du guide. "manifest.webmanifest" doit l'être aussi : un
  // navigateur qui évalue "Ajouter à l'écran d'accueil" le récupère sans
  // session active, et une redirection vers /login (HTML au lieu du JSON
  // attendu) empêche l'installation de fonctionner.
  matcher: [
    "/((?!api|_next/static|_next/image|uploads|icons|guide-assets|favicon.ico|manifest.webmanifest).*)",
  ],
};
