import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";
import { LogoUpload } from "./logo-upload";

export default async function ParametresPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration générale de l&apos;application.
        </p>
      </div>

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
            }}
          />
        </div>
      </div>
    </div>
  );
}
