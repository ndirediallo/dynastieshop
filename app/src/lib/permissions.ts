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
  | "credits"
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
  // Le recouvrement peut être fait par un(e) caissier(ère) différent(e) de
  // celui/celle qui a enregistré la vente à crédit initiale — l'accès n'est
  // donc pas restreint à "ses propres ventes" comme pour /ventes.
  credits: ["SUPER_ADMIN", "CAISSIER"],
  transferts: ["SUPER_ADMIN", "LOGISTIQUE"],
  depenses: ["SUPER_ADMIN"],
  clients: ["SUPER_ADMIN", "CAISSIER"],
  utilisateurs: ["SUPER_ADMIN"],
  rapports: ["SUPER_ADMIN", "CAISSIER", "LOGISTIQUE"],
  journal: ["SUPER_ADMIN"],
  parametres: ["SUPER_ADMIN"],
};

// `extraModules` vient s'ajouter aux modules du rôle (jamais les retirer) —
// un accès individuel accordé en plus, ex. un Caissier qui doit aussi
// consulter Stocks. Voir le champ User.extraModules.
export function can(role: Role, module: Module, extraModules: string[] = []): boolean {
  return MODULE_ROLES[module].includes(role) || extraModules.includes(module);
}

// Modules déjà couverts par le rôle seul — utile pour l'interface de
// gestion des utilisateurs, qui ne doit proposer en cases à cocher que les
// accès qui s'AJOUTENT au rôle, pas ceux qu'il inclut déjà.
export function defaultModulesForRole(role: Role): Module[] {
  return ALL_MODULES.filter((m) => MODULE_ROLES[m].includes(role));
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrateur",
  CAISSIER: "Caissier / Caissière",
  LOGISTIQUE: "Logistique",
};

export const MODULE_LABELS: Record<Module, string> = {
  boutiques: "Boutiques",
  produits: "Produits",
  stocks: "Stock",
  fournisseurs: "Fournisseurs",
  ventes: "Ventes (Caisse)",
  credits: "Crédits",
  transferts: "Transferts",
  depenses: "Dépenses",
  clients: "Clients",
  utilisateurs: "Utilisateurs",
  rapports: "Rapports",
  journal: "Journal d'activité",
  parametres: "Paramètres",
};

export const ALL_MODULES = Object.keys(MODULE_LABELS) as Module[];

// Sous-ensemble proposable en case à cocher ("accès supplémentaires") sur
// un compte Caissier/Logistique — jamais "boutiques", "utilisateurs",
// "journal" ou "parametres" : ce sont des pouvoirs d'administration de
// l'entreprise elle-même, sans version "limitée à ma boutique" qui ait un
// sens, contrairement à stocks/fournisseurs/transferts/dépenses (voir
// scoping dédié à chacun dans leurs pages respectives). Accorder l'un de
// ces quatre modules interdits reviendrait à faire de la personne un
// second Super Admin de fait.
export const GRANTABLE_EXTRA_MODULES: Module[] = ALL_MODULES.filter(
  (m) => !["boutiques", "utilisateurs", "journal", "parametres"].includes(m)
);
