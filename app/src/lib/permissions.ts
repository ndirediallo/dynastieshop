import type { Role } from "@prisma/client";

// Les modules du système, tels que définis dans le document d'architecture
// validé (section 5 — Rôles et permissions). Le Tableau de bord n'est pas
// listé ici car accessible à tout utilisateur connecté.
export type Module =
  | "boutiques"
  | "produits"
  | "stocks"
  | "fournisseurs"
  | "ventes"
  | "transferts"
  | "depenses"
  | "clients"
  | "utilisateurs"
  | "rapports"
  | "journal"
  | "parametres";

// Matrice simple rôle → modules autorisés (accès à la page). Certaines
// actions d'écriture, plus sensibles que la simple consultation (ex. créer
// un produit), sont resserrées au cas par cas via `requireRole()` dans les
// server actions concernées — cette matrice ne couvre que l'accès de base.
const MODULE_ROLES: Record<Module, Role[]> = {
  boutiques: ["SUPER_ADMIN"],
  produits: ["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"],
  stocks: ["SUPER_ADMIN", "LOGISTIQUE"],
  fournisseurs: ["SUPER_ADMIN", "LOGISTIQUE"],
  ventes: ["SUPER_ADMIN", "CAISSIER"],
  transferts: ["SUPER_ADMIN", "LOGISTIQUE"],
  depenses: ["SUPER_ADMIN"],
  clients: ["SUPER_ADMIN", "CAISSIER"],
  utilisateurs: ["SUPER_ADMIN"],
  rapports: ["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"],
  journal: ["SUPER_ADMIN"],
  parametres: ["SUPER_ADMIN"],
};

export function can(role: Role, module: Module): boolean {
  return MODULE_ROLES[module].includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrateur",
  CAISSIER: "Caissier / Caissière",
  LOGISTIQUE: "Logistique",
};
