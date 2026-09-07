-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'VOID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeploymentStatus" ADD VALUE 'UPGRADING';
ALTER TYPE "DeploymentStatus" ADD VALUE 'UPGRADED';

-- AlterTable
ALTER TABLE "ApplicationLicense" ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "verificationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "saleAmount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commission_orderItemId_key" ON "Commission"("orderItemId");

-- CreateIndex
CREATE INDEX "Commission_developerId_idx" ON "Commission"("developerId");

-- CreateIndex
CREATE INDEX "Commission_applicationId_idx" ON "Commission"("applicationId");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

