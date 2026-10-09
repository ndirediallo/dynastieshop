"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Package, UserPlus, ShoppingCart, KeyRound } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, can } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import type { SidebarBoutique } from "@/components/sidebar";

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    phone?: string | null;
    role: Role;
    extraModules?: string[];
    boutiqueId?: string | null;
  };
  logoUrl?: string | null;
  companyName: string;
  boutiques?: SidebarBoutique[];
}

export function DashboardHeader({
  user,
  logoUrl,
  companyName,
  boutiques,
}: DashboardHeaderProps) {
  const initials = (user.name || user.phone || "?").slice(0, 2).toUpperCase();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  // Rappel permanent de la boutique d'affectation, visible sur toutes les
  // pages (pas juste le tableau de bord) — voir discussion avec
  // l'utilisateur : facile à oublier en se connectant.
  const boutiqueName = boutiques?.find((b) => b.id === user.boutiqueId)?.name;

  return (
    <header className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <MobileNav
          role={user.role}
          extraModules={user.extraModules}
          logoUrl={logoUrl}
          companyName={companyName}
          boutiques={boutiques}
        />
        <span className="truncate text-lg font-semibold">{companyName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* Raccourcis d'action accessibles depuis n'importe quelle page —
            sans ça, créer un produit ou un client demande de naviguer
            jusqu'à la bonne page avant de pouvoir commencer. Masqués sous
            `sm` (téléphone) : à 3 boutons + thème + avatar, ça ne tenait
            plus sur 390px et poussait l'avatar hors de l'écran (repéré en
            testant la Caisse sur mobile) — le menu hamburger reste de
            toute façon à une distance d'un geste pour les mêmes pages. */}
        <div className="hidden items-center gap-1 sm:flex">
          {user.role === "SUPER_ADMIN" && (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/produits/nouveau" />}
              title="Ajouter un produit"
              className="bg-blue-600 text-white hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              <Package className="size-4" />
              <span className="hidden lg:inline">Nouveau produit</span>
            </Button>
          )}
          {can(user.role, "clients", user.extraModules) && (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/clients?new=1" />}
              title="Ajouter un client"
              className="bg-purple-600 text-white hover:bg-purple-500 dark:bg-purple-500 dark:hover:bg-purple-400"
            >
              <UserPlus className="size-4" />
              <span className="hidden lg:inline">Nouveau client</span>
            </Button>
          )}
          {can(user.role, "ventes", user.extraModules) && (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/ventes" />}
              title="Nouvelle vente"
            >
              <ShoppingCart className="size-4" />
              <span className="hidden lg:inline">Nouvelle vente</span>
            </Button>
          )}
        </div>
        <div className="hidden h-6 w-px bg-border sm:block" />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left text-sm sm:block">
              <div className="font-medium leading-none">{user.name}</div>
              <div className="text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
                {boutiqueName ? ` · ${boutiqueName}` : ""}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user.phone}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
              <KeyRound className="mr-2 size-4" />
              Changer mon mot de passe
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 size-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </header>
  );
}
