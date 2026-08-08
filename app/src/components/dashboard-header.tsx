"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
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
import { ROLE_LABELS } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    phone?: string | null;
    role: Role;
  };
  logoUrl?: string | null;
  companyName: string;
}

export function DashboardHeader({
  user,
  logoUrl,
  companyName,
}: DashboardHeaderProps) {
  const initials = (user.name || user.phone || "?").slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <MobileNav
          role={user.role}
          logoUrl={logoUrl}
          companyName={companyName}
        />
        <span className="text-lg font-semibold">{companyName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
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
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user.phone}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 size-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
