"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BreakdownRow {
  variantLabel: string;
  boutiqueId: string;
  boutiqueName: string;
  quantity: number;
  alertThreshold: number;
}

// Accessible à tout le monde (pas seulement au Super Admin) et sans passer
// par "Modifier" : consulter où se trouve un produit est une question de
// stock, pas d'édition — ne devrait jamais mettre un bouton Supprimer à
// portée de clic pour un simple coup d'œil.
export function StockBreakdownDialog({
  productName,
  rows,
  multipleVariants,
  boutiqueLinksEnabled = true,
}: {
  productName: string;
  rows: BreakdownRow[];
  multipleVariants: boolean;
  // Un Caissier n'a pas accès à /stocks (voir lib/permissions.ts) — le lien
  // mènerait à une redirection vers /unauthorized, donc on l'affiche en
  // texte simple pour lui plutôt qu'un lien mort.
  boutiqueLinksEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title="Voir la répartition du stock" />}>
        <MapPin className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Répartition du stock · {productName}</DialogTitle>
          <DialogDescription>
            Quantité disponible par emplacement, toutes variantes confondues.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {multipleVariants && <TableHead>Variante</TableHead>}
                <TableHead>Emplacement</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isOut = row.quantity <= 0;
                const isLow = !isOut && row.quantity <= row.alertThreshold;
                return (
                  <TableRow key={`${row.variantLabel}:${row.boutiqueId}`}>
                    {multipleVariants && (
                      <TableCell className="font-medium">{row.variantLabel}</TableCell>
                    )}
                    <TableCell>
                      {boutiqueLinksEnabled ? (
                        <Link
                          href={`/stocks?boutiqueId=${row.boutiqueId}`}
                          className="text-primary hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          {row.boutiqueName}
                        </Link>
                      ) : (
                        row.boutiqueName
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-figures font-semibold tabular-nums",
                        isOut && "text-destructive",
                        isLow && "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {row.quantity}
                    </TableCell>
                    <TableCell>
                      {isOut ? (
                        <Badge variant="destructive">Rupture</Badge>
                      ) : isLow ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        >
                          Stock faible
                        </Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
