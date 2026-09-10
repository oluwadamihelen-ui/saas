-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'KORAPAY');

-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "feePaymentProvider" "PaymentGatewayProvider",
ADD COLUMN     "feePaymentReference" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "provider" "PaymentGatewayProvider";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "activePaymentProvider" "PaymentGatewayProvider",
ADD COLUMN     "brandColor" TEXT;

-- CreateTable
CREATE TABLE "PaymentGatewayCredential" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKeyEnc" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentGatewayCredential_schoolId_idx" ON "PaymentGatewayCredential"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayCredential_schoolId_provider_key" ON "PaymentGatewayCredential"("schoolId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_feePaymentReference_key" ON "Applicant"("feePaymentReference");

-- AddForeignKey
ALTER TABLE "PaymentGatewayCredential" ADD CONSTRAINT "PaymentGatewayCredential_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

