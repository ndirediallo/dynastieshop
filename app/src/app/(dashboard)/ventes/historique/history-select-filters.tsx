"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export function HistorySelectFilters({
  boutiques,
  cashiers,
}: {
  boutiques: { id: string; name: string }[];
  cashiers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Changer de boutique ou de caissier revient à changer entièrement le
  // jeu de résultats filtré — la page courante n'a alors plus de sens et
  // est réinitialisée, comme pour un changement de période ou de statut.
  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const boutiqueId = searchParams.get("boutiqueId") ?? ALL;
  const userId = searchParams.get("userId") ?? ALL;

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-48 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Boutique</Label>
        <Select value={boutiqueId} onValueChange={(v) => updateParam("boutiqueId", v ?? ALL)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) =>
                v === ALL ? "Toutes les boutiques" : boutiques.find((b) => b.id === v)?.name
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les boutiques</SelectItem>
            {boutiques.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-48 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Caissier</Label>
        <Select value={userId} onValueChange={(v) => updateParam("userId", v ?? ALL)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) =>
                v === ALL ? "Tous les caissiers" : cashiers.find((c) => c.id === v)?.name
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les caissiers</SelectItem>
            {cashiers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
