-- AlterTable
ALTER TABLE "School" ADD COLUMN     "lastEmailDeliveryError" TEXT,
ADD COLUMN     "lastEmailDeliveryErrorAt" TIMESTAMP(3);
