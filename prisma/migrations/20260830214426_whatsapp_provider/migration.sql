-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('META', 'TWILIO');

-- AlterTable
ALTER TABLE "WhatsAppAccount" ADD COLUMN     "provider" "WhatsAppProvider" NOT NULL DEFAULT 'META';
