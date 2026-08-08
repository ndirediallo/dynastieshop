-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- Backfill : le compte Super Admin reçoit son vrai numéro ; tout autre
-- compte existant sans numéro connu reçoit un espace réservé unique et
-- explicite à corriger ensuite via la page Utilisateurs.
UPDATE "User" SET "phone" = '622269738' WHERE email = 'ndireetmoi@gmail.com';
UPDATE "User" SET "phone" = 'A_COMPLETER_' || substr(id, 1, 8) WHERE "phone" IS NULL;

ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email";

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
