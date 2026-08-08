"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: Role;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const initials = (user.name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between px-6">
      <div className="text-lg font-semibold md:hidden">DYNASTIE SHOP</div>
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
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
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
