"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saleEditRequestSchema, type SaleEditRequestInput } from "@/lib/schemas";
import { createSaleEditRequest } from "../actions";

// Un Caissier ne peut jamais corriger une vente lui-même (voir actions.ts,
// createReturn est réservé au Super Admin) — il peut seulement signaler le
// problème. C'est le seul geste qui lui reste face à une erreur de saisie.
export function SaleEditRequestDialog({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SaleEditRequestInput>({
    resolver: zodResolver(saleEditRequestSchema),
    defaultValues: { saleId, reason: "" },
  });

  const onSubmit = async (values: SaleEditRequestInput) => {
    const result = await createSaleEditRequest(values);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Demande envoyée au Super Admin");
    reset({ saleId, reason: "" });
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <TriangleAlert className="mr-2 size-4" />
        Signaler une erreur
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander une correction</DialogTitle>
          <DialogDescription>
            Décrivez le problème. Seul le Super Admin peut effectuer la correction, pour des
            raisons de contrôle.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Que s&apos;est-il passé ?</Label>
            <Textarea
              id="reason"
              placeholder="Ex : quantité saisie en trop, mauvais article scanné..."
              rows={3}
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Envoi..." : "Envoyer la demande"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
