-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Track"
  DROP COLUMN "previewUrl";
