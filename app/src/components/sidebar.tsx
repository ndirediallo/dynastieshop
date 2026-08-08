"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Store,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  Users,
  UserCog,
  BarChart3,
  History,
  Settings,
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
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/boutiques", label: "Boutiques", icon: Store, module: "boutiques" },
  { href: "/produits", label: "Produits", icon: Package, module: "produits" },
  { href: "/stocks", label: "Stocks", icon: Boxes, module: "stocks" },
  {
    href: "/fournisseurs",
    label: "Fournisseurs",
    icon: Truck,
    module: "fournisseurs",
  },
  { href: "/ventes", label: "Ventes", icon: ShoppingCart, module: "ventes" },
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
];

export function Sidebar({
  role,
  logoUrl,
  companyName,
}: {
  role: Role;
  logoUrl?: string | null;
  companyName: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.module || can(role, item.module));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
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
        <span className="truncate text-base font-semibold tracking-tight text-foreground">
          {companyName}
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
