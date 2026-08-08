import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { existsSync } from "fs";
import { copyFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

// Identifiants du compte Super Administrateur initial (connexion par
// téléphone + code à 4 chiffres). À changer après la première connexion si
// besoin (page Utilisateurs).
const SUPER_ADMIN_PHONE = "622269738";
const SUPER_ADMIN_PASSWORD = "1234";

// Reprend le logo fourni dans le dossier du projet (LOGO .png, à la racine
// de DYNASTIE GESTION) pour préremplir les Paramètres.
async function seedLogo(): Promise<string | null> {
  const sourcePath = path.join(process.cwd(), "..", "LOGO .png");
  if (!existsSync(sourcePath)) return null;

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const destPath = path.join(uploadsDir, "logo.png");
  await copyFile(sourcePath, destPath);
  return "/uploads/logo.png";
}

async function main() {
  const logoUrl = await seedLogo();

  const settings = await prisma.settings.findFirst();
  if (!settings) {
    await prisma.settings.create({
      data: {
        companyName: "DYNASTIE SHOP",
        currency: "GNF",
        logoUrl,
      },
    });
    console.log("✔ Paramètres initiaux créés");
  }

  let boutique = await prisma.boutique.findFirst({
    where: { name: "Boutique Principale" },
  });
  if (!boutique) {
    boutique = await prisma.boutique.create({
      data: { name: "Boutique Principale", type: "BOUTIQUE" },
    });
    console.log("✔ Boutique par défaut créée");
  }

  const entrepot = await prisma.boutique.findFirst({
    where: { type: "ENTREPOT" },
  });
  if (!entrepot) {
    await prisma.boutique.create({
      data: { name: "Entrepôt Central", type: "ENTREPOT" },
    });
    console.log("✔ Entrepôt central créé");
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { phone: SUPER_ADMIN_PHONE },
  });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        name: "Super Administrateur",
        phone: SUPER_ADMIN_PHONE,
        passwordHash,
        role: "SUPER_ADMIN",
        boutiqueId: boutique.id,
      },
    });
    console.log(`✔ Compte Super Administrateur créé : ${SUPER_ADMIN_PHONE}`);
    console.log(`  Code initial : ${SUPER_ADMIN_PASSWORD}`);
  } else {
    console.log("… Compte Super Administrateur déjà existant, aucune action");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
