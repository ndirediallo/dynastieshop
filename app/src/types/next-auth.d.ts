import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Étend les types Auth.js pour transporter le rôle et la boutique de
// l'utilisateur dans la session et le JWT.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      boutiqueId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    boutiqueId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    boutiqueId: string | null;
  }
}
