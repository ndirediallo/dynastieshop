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
  // "uploads" doit rester public : ce sont des fichiers statiques (logo,
  // photos produits...) servis depuis /public, y compris via l'optimiseur
  // d'images de Next.js qui les relit en interne sans cookie de session.
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico).*)"],
};
