-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTransactionType" ADD VALUE 'GENERATION_SPEND';
ALTER TYPE "WalletTransactionType" ADD VALUE 'GENERATION_REFUND';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "includedGenerationDoe" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "doeCostPerReferenceImage" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "doeCostPerVideoSecond" INTEGER NOT NULL DEFAULT 7;
