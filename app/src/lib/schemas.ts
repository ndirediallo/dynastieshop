import { z } from "zod";

// Schémas Zod partagés entre les server actions et les formulaires client
// (un fichier "use server" ne peut exporter que des fonctions async, ces
// schémas doivent donc vivre dans un module séparé).

export const boutiqueSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  address: z.string().optional(),
  phone: z.string().optional(),
});
export type BoutiqueInput = z.infer<typeof boutiqueSchema>;

export const userCreateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: z.enum(["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "LOGISTIQUE", "CAISSIER"]),
  boutiqueId: z.string().nullable().optional(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse e-mail invalide"),
  role: z.enum(["SUPER_ADMIN", "RESPONSABLE_BOUTIQUE", "LOGISTIQUE", "CAISSIER"]),
  boutiqueId: z.string().nullable().optional(),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .optional()
    .or(z.literal("")),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const settingsSchema = z.object({
  companyName: z.string().min(2, "Le nom de l'entreprise est requis"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Adresse e-mail invalide").optional().or(z.literal("")),
  currency: z.string().min(1, "La devise est requise"),
  invoicePrefix: z.string().min(1, "Le préfixe de facture est requis"),
  invoiceNextNumber: z.number().int().min(1),
  ticketPrefix: z.string().min(1, "Le préfixe de ticket est requis"),
  ticketNextNumber: z.number().int().min(1),
});
export type SettingsInput = z.infer<typeof settingsSchema>;
