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

export function BoutiqueFilter({ boutiques }: { boutiques: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const boutiqueId = searchParams.get("boutiqueId") ?? ALL;

  function updateParam(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete("boutiqueId");
    else params.set("boutiqueId", value);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="w-56 space-y-1.5">
      <Label className="text-xs text-muted-foreground">Boutique</Label>
      <Select value={boutiqueId} onValueChange={(v) => updateParam(v ?? ALL)}>
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
  );
}
