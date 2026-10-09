"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav, type SidebarProps } from "@/components/sidebar";

// Équivalent de la sidebar pour les écrans étroits (en dessous du
// breakpoint `md`), où la sidebar fixe est masquée : un bouton dans l'en-tête
// ouvre le même menu dans un panneau coulissant.
export function MobileNav(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Ferme le panneau dès que la page change, quelle que soit la façon dont
  // la navigation a été déclenchée — plus fiable que fermer directement
  // depuis le onClick du lien, qui entrait en conflit avec la navigation
  // côté client de Next.js (le lien ne naviguait plus du tout). On observe
  // aussi les search params : passer de "Stock global" à une boutique reste
  // sur /stocks et ne change que ?boutiqueId=...
  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" />}>
        <Menu className="size-5" />
        <span className="sr-only">Ouvrir le menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 sm:max-w-72">
        <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
        <SidebarNav {...props} />
      </SheetContent>
    </Sheet>
  );
}
