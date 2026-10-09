"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@prisma/client";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Store,
  LayoutGrid,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  HandCoins,
  Users,
  UserCog,
  BarChart3,
  History,
  Settings,
  ArrowLeftRight,
  Wallet,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { can, type Module } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Un module non renseigné est visible par tout utilisateur connecté
  // (c'est le cas du tableau de bord).
  module?: Module;
  // "Vendre" (vente/caisse) est le cœur de l'activité quotidienne — placé
  // juste après Boutiques et stylé en permanence (pas seulement à l'état
  // actif) pour rester le point d'entrée le plus visible du menu.
  highlight?: boolean;
}

// Marqueur spécial : à cet emplacement dans le menu, on rend un groupe
// dynamique plutôt qu'un simple lien, car son contenu dépend des boutiques
// actives (voir BoutiquesNavGroup ci-dessous).
//
// "Stock" était auparavant, comme "Boutiques", un groupe qui listait
// chaque boutique — les 4 mêmes boutiques apparaissaient donc deux fois
// dans le menu (une fois sous "Boutiques", une fois sous "Stock"), ce qui a
// été signalé par l'utilisateur comme une vraie source de confusion. Le
// stock d'une boutique précise reste accessible, mais via cette boutique
// (Boutiques → la boutique → "Voir le stock détaillé"), jamais comme une
// seconde liste parallèle. "Stock" est donc redevenu un lien simple, qui
// mène directement au stock de l'entrepôt (vue par défaut de /stocks — voir
// stocks/page.tsx).
const BOUTIQUES_GROUP_HREF = "/boutiques";

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: BOUTIQUES_GROUP_HREF, label: "Boutiques", icon: Store, module: "boutiques" },
  { href: "/ventes", label: "Vendre", icon: ShoppingCart, module: "ventes", highlight: true },
  { href: "/produits", label: "Produits", icon: Package, module: "produits" },
  { href: "/stocks", label: "Stock", icon: Boxes, module: "stocks" },
  {
    href: "/fournisseurs",
    label: "Fournisseurs",
    icon: Truck,
    module: "fournisseurs",
  },
  { href: "/credits", label: "Crédits", icon: HandCoins, module: "credits" },
  {
    href: "/transferts",
    label: "Transferts",
    icon: ArrowLeftRight,
    module: "transferts",
  },
  { href: "/depenses", label: "Dépenses", icon: Wallet, module: "depenses" },
  { href: "/clients", label: "Clients", icon: Users, module: "clients" },
  {
    href: "/utilisateurs",
    label: "Utilisateurs",
    icon: UserCog,
    module: "utilisateurs",
  },
  { href: "/rapports", label: "Rapports", icon: BarChart3, module: "rapports" },
  {
    href: "/journal",
    label: "Journal d'activité",
    icon: History,
    module: "journal",
  },
  {
    href: "/parametres",
    label: "Paramètres",
    icon: Settings,
    module: "parametres",
  },
  // Pas de `module` : accessible à tout compte connecté — chaque module de
  // la page elle-même reste filtré par rôle (voir /guide), même logique que
  // le tableau de bord.
  { href: "/guide", label: "Guide d'utilisation", icon: BookOpen },
];

export interface SidebarBoutique {
  id: string;
  name: string;
  type: "BOUTIQUE" | "ENTREPOT";
}

export interface SidebarProps {
  role: Role;
  extraModules?: string[];
  logoUrl?: string | null;
  companyName: string;
  boutiques?: SidebarBoutique[];
  onNavigate?: () => void;
}

// "Boutiques" se déplie : "Toutes les boutiques" mène à la grille de
// gestion (créer, désactiver...), et chaque boutique a un lien direct vers
// son tableau de bord d'activité. L'entrepôt n'apparaît pas ici — ce n'est
// pas une boutique ; son propre tableau de bord est accessible depuis
// "Stock" (vue par défaut de /stocks), via le bouton "Tableau de bord".
function BoutiquesNavGroup({
  boutiques,
  pathname,
  onNavigate,
}: {
  boutiques: SidebarBoutique[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const shops = boutiques.filter((b) => b.type === "BOUTIQUE");
  const isOnAllBoutiques = pathname === BOUTIQUES_GROUP_HREF;
  const isOnAShop = shops.some((b) => pathname === `/boutiques/${b.id}`);
  const [open, setOpen] = useState(isOnAllBoutiques || isOnAShop);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isOnAllBoutiques || isOnAShop
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Store className="size-4" />
        <span className="flex-1 text-left">Boutiques</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-1 space-y-1 border-l border-sidebar-border pl-4">
          <Link
            href={BOUTIQUES_GROUP_HREF}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isOnAllBoutiques
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <LayoutGrid className="size-4" />
            Toutes les boutiques
          </Link>
          {shops.map((b) => {
            const href = `/boutiques/${b.id}`;
            const isActive = pathname === href;
            return (
              <Link
                key={b.id}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Store className="size-4" />
                {b.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Contenu de la navigation, réutilisé à la fois par la sidebar fixe
// (desktop) et par le menu coulissant (mobile, voir mobile-nav.tsx) — pour
// ne jamais avoir deux listes de modules à maintenir en parallèle.
export function SidebarNav({
  role,
  extraModules = [],
  logoUrl,
  companyName,
  boutiques = [],
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.module || can(role, item.module, extraModules));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-6">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={companyName}
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-md object-contain"
          />
        ) : (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {companyName.slice(0, 1)}
          </div>
        )}
        <span className="truncate text-base font-semibold tracking-tight text-white">
          {companyName}
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          if (item.href === BOUTIQUES_GROUP_HREF) {
            return (
              <BoutiquesNavGroup
                key={item.href}
                boutiques={boutiques}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            );
          }
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : item.highlight
                    ? "border border-primary/40 bg-primary/15 font-semibold text-primary hover:bg-primary/25"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// Sidebar fixe, visible uniquement à partir du breakpoint `md`. En dessous,
// c'est mobile-nav.tsx (menu coulissant) qui prend le relais.
export function Sidebar(props: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
      <SidebarNav {...props} />
    </aside>
  );
}
