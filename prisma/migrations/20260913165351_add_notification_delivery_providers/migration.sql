-- CreateEnum
CREATE TYPE "NotificationDeliveryProvider" AS ENUM ('RESEND', 'TWILIO', 'SENTDM');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "activeEmailProvider" "NotificationDeliveryProvider",
ADD COLUMN     "activeSmsProvider" "NotificationDeliveryProvider";

-- CreateTable
CREATE TABLE "NotificationProviderCredential" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" "NotificationDeliveryProvider" NOT NULL,
    "fromIdentifier" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "accountSidEnc" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationProviderCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationProviderCredential_schoolId_idx" ON "NotificationProviderCredential"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationProviderCredential_schoolId_provider_key" ON "NotificationProviderCredential"("schoolId", "provider");

-- AddForeignKey
ALTER TABLE "NotificationProviderCredential" ADD CONSTRAINT "NotificationProviderCredential_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
