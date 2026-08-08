"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { settingsSchema, type SettingsInput } from "@/lib/schemas";
import { updateSettings } from "./actions";

export function SettingsForm({ settings }: { settings: SettingsInput }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  const onSubmit = async (values: SettingsInput) => {
    setIsSubmitting(true);
    try {
      await updateSettings(values);
      toast.success("Paramètres enregistrés avec succès");
    } catch {
      toast.error("Une erreur est survenue. Vérifiez les informations saisies.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informations de l&apos;entreprise</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
              <Input id="companyName" {...register("companyName")} />
              {errors.companyName && (
                <p className="text-sm text-destructive">
                  {errors.companyName.message}
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <Input id="currency" {...register("currency")} />
              {errors.currency && (
                <p className="text-sm text-destructive">
                  {errors.currency.message}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">
              Numérotation des factures et tickets
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Préfixe facture</Label>
                <Input id="invoicePrefix" {...register("invoicePrefix")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceNextNumber">Prochain n° de facture</Label>
                <Input
                  id="invoiceNextNumber"
                  type="number"
                  min={1}
                  {...register("invoiceNextNumber", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketPrefix">Préfixe ticket</Label>
                <Input id="ticketPrefix" {...register("ticketPrefix")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketNextNumber">Prochain n° de ticket</Label>
                <Input
                  id="ticketNextNumber"
                  type="number"
                  min={1}
                  {...register("ticketNextNumber", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer les paramètres"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
