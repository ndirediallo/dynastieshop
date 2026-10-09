import { Settings, AlertTriangle } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";
import { LogoUpload } from "./logo-upload";
import { FactoryResetDialog } from "./factory-reset-dialog";
import { RESET_CONFIRMATION_PHRASE } from "./factory-reset-constants";

export default async function ParametresPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Paramètres"
        description="Configuration générale de l'application."
        tint="slate"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <LogoUpload logoUrl={settings.logoUrl} />
        </div>
        <div className="lg:col-span-2">
          <SettingsForm
            settings={{
              companyName: settings.companyName,
              address: settings.address ?? "",
              phone: settings.phone ?? "",
              email: settings.email ?? "",
              currency: settings.currency,
              invoicePrefix: settings.invoicePrefix,
              invoiceNextNumber: settings.invoiceNextNumber,
              ticketPrefix: settings.ticketPrefix,
              ticketNextNumber: settings.ticketNextNumber,
              defaultAlertThreshold: settings.defaultAlertThreshold,
              maxFailedLoginAttempts: settings.maxFailedLoginAttempts,
              lockoutDurationMinutes: settings.lockoutDurationMinutes,
              maxDiscountPercent: settings.maxDiscountPercent,
              activePaymentMethods: settings.activePaymentMethods,
              defaultDeliveryFee: settings.defaultDeliveryFee,
            }}
          />
        </div>
      </div>

      {/* Zone de danger, bien séparée visuellement du reste. Reste disponible en
          permanence (pas seulement avant la livraison à une cliente) : le texte
          doit donc rester générique, pas formulé comme une étape ponctuelle. */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" />
            Zone de danger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Efface définitivement les produits, ventes, stocks, clients,
            fournisseurs, boutiques et comptes utilisateurs pour repartir
            d&apos;une application vierge. Réservée au Super Admin : il faut
            taper exactement la phrase « {RESET_CONFIRMATION_PHRASE} » pour
            confirmer, rien ne peut se déclencher par erreur.
          </p>
          <FactoryResetDialog />
        </CardContent>
      </Card>
    </div>
  );
}
