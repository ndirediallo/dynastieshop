import type { Role } from "@prisma/client";

// Les 11 modules du cahier des charges (le Tableau de bord n'est pas listé
// ici séparément car accessible à tous les rôles connectés).
export type Module =
  | "boutiques"
  | "produits"
  | "stocks"
  | "fournisseurs"
  | "ventes"
  | "clients"
  | "utilisateurs"
  | "rapports"
  | "journal"
  | "parametres";

// Matrice simple rôle → modules autorisés. Centralisée ici pour pouvoir
// évoluer vers des permissions plus fines (par action) en V2 sans changer
// les appels dans le reste du code.
const MODULE_ROLES: Record<Module, Role[]> = {
  boutiques: ["SUPER_ADMIN"],
  produits: ["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "LOGISTIQUE"],
  stocks: ["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "LOGISTIQUE"],
  fournisseurs: ["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "LOGISTIQUE"],
  ventes: ["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "CAISSIER"],
  clients: ["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "CAISSIER"],
  utilisateurs: ["SUPER_ADMIN"],
  rapports: ["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE"],
  journal: ["SUPER_ADMIN"],
  parametres: ["SUPER_ADMIN"],
};

export function can(role: Role, module: Module): boolean {
  return MODULE_ROLES[module].includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrateur",
  RESPONSABLE_BOUTIQUE: "Responsable de boutique",
  LOGISTIQUE: "Logistique",
  CAISSIER: "Caissier / Caissière",
};
