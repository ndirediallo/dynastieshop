import Image from "next/image";
import { cn } from "@/lib/utils";

// Évite l'effet "image cassée" d'une icône générique quand un produit n'a
// pas encore de photo : une initiale sur fond neutre, délibérée, plutôt
// qu'un espace qui a l'air inachevé.
export function ProductThumbnail({
  name,
  photoUrl,
  className,
  rounded = "rounded-md",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  rounded?: string;
}) {
  if (photoUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", rounded, className)}>
        <Image src={photoUrl} alt={name} fill sizes="200px" className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted text-sm font-semibold text-muted-foreground",
        rounded,
        className
      )}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}
