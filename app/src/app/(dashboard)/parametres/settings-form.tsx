"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { settingsSchema, type SettingsInput } from "@/lib/schemas";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { updateSettings } from "./actions";

export function SettingsForm({ settings }: { settings: SettingsInput }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
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

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">Stock</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultAlertThreshold">
                  Seuil d&apos;alerte par défaut
                </Label>
                <Input
                  id="defaultAlertThreshold"
                  type="number"
                  min={0}
                  {...register("defaultAlertThreshold", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Valeur pré-remplie à la création d&apos;un nouveau produit,
                  modifiable ensuite produit par produit.
                </p>
                {errors.defaultAlertThreshold && (
                  <p className="text-sm text-destructive">
                    {errors.defaultAlertThreshold.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">Livraison</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultDeliveryFee">
                  Frais de livraison par défaut
                </Label>
                <Input
                  id="defaultDeliveryFee"
                  type="number"
                  min={0}
                  {...register("defaultDeliveryFee", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Pré-rempli en Caisse quand une livraison est ajoutée à une
                  vente, modifiable à chaque vente (trajet plus loin,
                  livraison offerte...).
                </p>
                {errors.defaultDeliveryFee && (
                  <p className="text-sm text-destructive">
                    {errors.defaultDeliveryFee.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">Sécurité des comptes</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxFailedLoginAttempts">
                  Essais avant blocage
                </Label>
                <Input
                  id="maxFailedLoginAttempts"
                  type="number"
                  min={3}
                  max={20}
                  {...register("maxFailedLoginAttempts", { valueAsNumber: true })}
                />
                {errors.maxFailedLoginAttempts && (
                  <p className="text-sm text-destructive">
                    {errors.maxFailedLoginAttempts.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockoutDurationMinutes">
                  Durée du blocage (minutes)
                </Label>
                <Input
                  id="lockoutDurationMinutes"
                  type="number"
                  min={1}
                  max={1440}
                  {...register("lockoutDurationMinutes", { valueAsNumber: true })}
                />
                {errors.lockoutDurationMinutes && (
                  <p className="text-sm text-destructive">
                    {errors.lockoutDurationMinutes.message}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Après ce nombre d&apos;échecs de connexion consécutifs, un compte
              est bloqué temporairement : protection contre les essais répétés
              d&apos;un code à 4 chiffres.
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">Remises en Caisse</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxDiscountPercent">
                  Remise maximale autorisée (%)
                </Label>
                <Input
                  id="maxDiscountPercent"
                  type="number"
                  min={0}
                  max={100}
                  {...register("maxDiscountPercent", { valueAsNumber: true })}
                />
                {errors.maxDiscountPercent && (
                  <p className="text-sm text-destructive">
                    {errors.maxDiscountPercent.message}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Au-delà de ce pourcentage, la Caisse refuse la vente. Ne
              s&apos;applique pas au Super Admin, toujours libre d&apos;appliquer
              la remise qu&apos;il juge nécessaire.
            </p>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">
              Méthodes de paiement actives
            </h3>
            <Controller
              control={control}
              name="activePaymentMethods"
              render={({ field }) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((method) => {
                    const checked = field.value.includes(method);
                    return (
                      <label
                        key={method}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 text-sm hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={checked}
                          onChange={(e) => {
                            field.onChange(
                              e.target.checked
                                ? [...field.value, method]
                                : field.value.filter((m) => m !== method)
                            );
                          }}
                        />
                        {PAYMENT_METHOD_LABELS[method]}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.activePaymentMethods && (
              <p className="mt-2 text-sm text-destructive">
                {errors.activePaymentMethods.message}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Décochées, elles n&apos;apparaissent plus dans les formulaires de
              vente, de remboursement et de paiement fournisseur.
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Enregistrer les paramètres"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
