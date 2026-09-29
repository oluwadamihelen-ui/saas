-- CreateEnum
CREATE TYPE "PaymentProviderType" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'KORAPAY');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "provider" "PaymentProviderType";

-- CreateTable
CREATE TABLE "HotelPaymentSettings" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "activeProvider" "PaymentProviderType",
    "paystackPublicKey" TEXT,
    "paystackSecretKeyEnc" TEXT,
    "flutterwavePublicKey" TEXT,
    "flutterwaveSecretKeyEnc" TEXT,
    "flutterwaveWebhookHashEnc" TEXT,
    "korapayPublicKey" TEXT,
    "korapaySecretKeyEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelPaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelPaymentSettings_hotelId_key" ON "HotelPaymentSettings"("hotelId");

-- AddForeignKey
ALTER TABLE "HotelPaymentSettings" ADD CONSTRAINT "HotelPaymentSettings_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
