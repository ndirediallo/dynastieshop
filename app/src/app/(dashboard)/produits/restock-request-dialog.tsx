"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { restockRequestSchema, type RestockRequestInput } from "@/lib/schemas";
import { createRestockRequest } from "../transferts/actions";

interface VariantOption {
  id: string;
  label: string;
  stockHere: number;
}

// Seul geste qu'un Caissier a face à une rupture dans sa boutique (il n'a
// pas accès au module Transferts) : signaler le besoin à
// Logistique/Super Admin, voir createRestockRequest.
export function RestockRequestDialog({
  productName,
  variants,
}: {
  productName: string;
  variants: VariantOption[];
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<RestockRequestInput>({
    resolver: zodResolver(restockRequestSchema),
    defaultValues: { variantId: variants[0]?.id ?? "", quantity: null, note: "" },
  });

  const onSubmit = async (values: RestockRequestInput) => {
    const result = await createRestockRequest(values);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Demande ${result.data.reference} envoyée`);
    reset({ variantId: variants[0]?.id ?? "", quantity: null, note: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title="Demander un réapprovisionnement" />}>
        <PackagePlus className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander un réapprovisionnement</DialogTitle>
          <DialogDescription>{productName} : envoyé à Logistique/Super Admin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {variants.length > 1 && (
            <div className="space-y-2">
              <Label>Variante</Label>
              <Controller
                control={control}
                name="variantId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choisir">
                        {(v: string) => variants.find((x) => x.id === v)?.label ?? "Choisir"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label} · {v.stockHere} en stock
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantité souhaitée (optionnel)</Label>
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optionnel)</Label>
            <Textarea id="note" rows={2} {...register("note")} />
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
