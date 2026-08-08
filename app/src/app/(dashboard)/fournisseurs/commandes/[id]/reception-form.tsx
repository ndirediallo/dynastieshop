"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { receivePurchaseOrder } from "../../actions";

interface ReceptionLine {
  itemId: string;
  label: string;
  quantityOrdered: number;
  quantityReceived: number;
}

export function ReceptionForm({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: string;
  lines: ReceptionLine[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(
      lines.map((l) => [l.itemId, Math.max(l.quantityOrdered - l.quantityReceived, 0)])
    )
  );

  const pending = lines.filter((l) => l.quantityReceived < l.quantityOrdered);

  const onSubmit = async () => {
    const linesToSend = pending
      .map((l) => ({ itemId: l.itemId, quantityReceivedNow: values[l.itemId] || 0 }))
      .filter((l) => l.quantityReceivedNow > 0);

    if (linesToSend.length === 0) {
      toast.error("Indiquez une quantité reçue pour au moins une ligne.");
      return;
    }

    setIsSubmitting(true);
    try {
      await receivePurchaseOrder(purchaseOrderId, { lines: linesToSend });
      toast.success("Réception enregistrée avec succès");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pending.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Toutes les lignes ont été intégralement reçues.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Commandé</TableHead>
              <TableHead>Déjà reçu</TableHead>
              <TableHead>Reçu maintenant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((line) => {
              const max = line.quantityOrdered - line.quantityReceived;
              return (
                <TableRow key={line.itemId}>
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell>{line.quantityOrdered}</TableCell>
                  <TableCell>{line.quantityReceived}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      className="w-24"
                      value={values[line.itemId] ?? 0}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [line.itemId]: Math.min(Number(e.target.value) || 0, max),
                        }))
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Button onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? "Enregistrement..." : "Enregistrer la réception"}
      </Button>
    </div>
  );
}
