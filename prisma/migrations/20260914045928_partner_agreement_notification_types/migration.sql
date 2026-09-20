-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PLATFORM_PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'COMMERCIAL_AGREEMENT_ACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE 'RENT_SUBSCRIPTION_STOPPED';
