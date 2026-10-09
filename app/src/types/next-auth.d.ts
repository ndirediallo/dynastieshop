import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Étend les types Auth.js pour transporter le téléphone, le rôle et la
// boutique de l'utilisateur dans la session et le JWT.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string;
      role: Role;
      boutiqueId: string | null;
      extraModules: string[];
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    phone: string;
    role: Role;
    boutiqueId: string | null;
    extraModules: string[];
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    phone: string;
    role: Role;
    boutiqueId: string | null;
    extraModules: string[];
    mustChangePassword: boolean;
  }
}
