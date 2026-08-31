-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SECURITY_ALERT';

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "lockedUntil" TIMESTAMP(3);
