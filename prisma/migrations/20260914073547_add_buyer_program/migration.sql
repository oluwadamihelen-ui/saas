-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BuyerAgreementStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuyerProgressStage" AS ENUM ('ORDER_CONFIRMED', 'IN_DEVELOPMENT', 'INSTALLATION', 'DELIVERED');

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "status" "BuyerStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceInquiryId" TEXT,
    "createdById" TEXT NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "suspendedById" TEXT,
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerAgreement" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" "BuyerAgreementStatus" NOT NULL DEFAULT 'PENDING',
    "agreementValueMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentArrangement" "PaymentArrangement",
    "progressStage" "BuyerProgressStage" NOT NULL DEFAULT 'ORDER_CONFIRMED',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "endedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProgressUpdate" (
    "id" TEXT NOT NULL,
    "buyerAgreementId" TEXT NOT NULL,
    "stage" "BuyerProgressStage" NOT NULL,
    "note" TEXT,
    "postedById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerInvoice" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerAgreementId" TEXT NOT NULL,
    "description" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "provider" "PaymentGatewayProvider",
    "providerReference" TEXT,
    "markedPaidById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_userId_key" ON "Buyer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_sourceInquiryId_key" ON "Buyer"("sourceInquiryId");

-- CreateIndex
CREATE INDEX "Buyer_status_idx" ON "Buyer"("status");

-- CreateIndex
CREATE INDEX "BuyerAgreement_buyerId_idx" ON "BuyerAgreement"("buyerId");

-- CreateIndex
CREATE INDEX "BuyerAgreement_status_idx" ON "BuyerAgreement"("status");

-- CreateIndex
CREATE INDEX "BuyerProgressUpdate_buyerAgreementId_idx" ON "BuyerProgressUpdate"("buyerAgreementId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerInvoice_providerReference_key" ON "BuyerInvoice"("providerReference");

-- CreateIndex
CREATE INDEX "BuyerInvoice_buyerId_idx" ON "BuyerInvoice"("buyerId");

-- CreateIndex
CREATE INDEX "BuyerInvoice_buyerAgreementId_idx" ON "BuyerInvoice"("buyerAgreementId");

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_sourceInquiryId_fkey" FOREIGN KEY ("sourceInquiryId") REFERENCES "EnterpriseInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProgressUpdate" ADD CONSTRAINT "BuyerProgressUpdate_buyerAgreementId_fkey" FOREIGN KEY ("buyerAgreementId") REFERENCES "BuyerAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProgressUpdate" ADD CONSTRAINT "BuyerProgressUpdate_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerInvoice" ADD CONSTRAINT "BuyerInvoice_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerInvoice" ADD CONSTRAINT "BuyerInvoice_buyerAgreementId_fkey" FOREIGN KEY ("buyerAgreementId") REFERENCES "BuyerAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerInvoice" ADD CONSTRAINT "BuyerInvoice_markedPaidById_fkey" FOREIGN KEY ("markedPaidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerInvoice" ADD CONSTRAINT "BuyerInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
