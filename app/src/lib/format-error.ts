import { ZodError } from "zod";

// Les server actions qui manipulent des lignes dynamiques (paiements,
// articles d'un panier, lignes de commande...) peuvent recevoir des
// données qui passent une vérification côté client mais échouent à la
// validation stricte du serveur (ex. une ligne à 0 ajoutée par erreur).
// Sans ce filet, une ZodError non interceptée remonte comme une erreur 500
// brute plutôt qu'un message compréhensible affiché dans un toast.
export function formatZodError(error: unknown, fallback = "Données invalides."): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  return fallback;
}
