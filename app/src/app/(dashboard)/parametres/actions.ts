"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/guard";
import { logActivity } from "@/lib/activity-log";
import { getSettings } from "@/lib/settings";
import { settingsSchema, type SettingsInput } from "@/lib/schemas";
import { uploadToStorage } from "@/lib/supabase-storage";

export async function updateSettings(input: SettingsInput) {
  const user = await requireModuleAccess("parametres");
  const data = settingsSchema.parse(input);
  const settings = await getSettings();

  const updated = await prisma.settings.update({
    where: { id: settings.id },
    data: {
      companyName: data.companyName,
      address: data.address,
      phone: data.phone,
      email: data.email || null,
      currency: data.currency,
      invoicePrefix: data.invoicePrefix,
      invoiceNextNumber: data.invoiceNextNumber,
      ticketPrefix: data.ticketPrefix,
      ticketNextNumber: data.ticketNextNumber,
      defaultAlertThreshold: data.defaultAlertThreshold,
      maxFailedLoginAttempts: data.maxFailedLoginAttempts,
      lockoutDurationMinutes: data.lockoutDurationMinutes,
      maxDiscountPercent: data.maxDiscountPercent,
      activePaymentMethods: data.activePaymentMethods,
      defaultDeliveryFee: data.defaultDeliveryFee,
      idleTimeoutMinutes: data.idleTimeoutMinutes,
      idleTimeoutMode: data.idleTimeoutMode,
    },
  });

  await logActivity({
    userId: user.id,
    action: "SETTINGS_UPDATED",
    entityType: "Settings",
    entityId: updated.id,
    details: "Paramètres de l'application modifiés",
  });

  revalidatePath("/parametres");
  return updated;
}

export async function uploadLogo(formData: FormData) {
  const user = await requireModuleAccess("parametres");
  const file = formData.get("logo") as File | null;

  if (!file || file.size === 0) {
    throw new Error("Aucun fichier fourni");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier doit être une image");
  }

  const settings = await getSettings();

  const ext = file.name.split(".").pop() || "png";
  const filename = `logo-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const logoUrl = await uploadToStorage(buffer, filename, file.type);

  await prisma.settings.update({
    where: { id: settings.id },
    data: { logoUrl },
  });

  await logActivity({
    userId: user.id,
    action: "SETTINGS_LOGO_UPDATED",
    entityType: "Settings",
    entityId: settings.id,
    details: "Logo de l'entreprise mis à jour",
  });

  revalidatePath("/parametres");
  return { logoUrl };
}
