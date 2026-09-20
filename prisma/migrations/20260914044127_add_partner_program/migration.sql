-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('LINK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('ACTIVE', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "CommercialMode" AS ENUM ('BUY', 'RENT');

-- CreateEnum
CREATE TYPE "CommercialAgreementStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentArrangement" AS ENUM ('ONE_TIME', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "PartnerCommissionPolicy" AS ENUM ('RECURRING', 'FIRST_PAYMENT_ONLY');

-- CreateEnum
CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'PAID', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartnerWithdrawalStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "PlatformInvoice" ADD COLUMN     "commercialAgreementId" TEXT,
ALTER COLUMN "subscriptionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "payoutBankName" TEXT,
    "payoutAccountName" TEXT,
    "payoutAccountNumber" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedById" TEXT,
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerReferral" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "source" "ReferralSource" NOT NULL,
    "referralCodeUsed" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'ACTIVE',
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attributedById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overriddenById" TEXT,
    "overrideReason" TEXT,
    "previousPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialAgreement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "partnerId" TEXT,
    "commercialMode" "CommercialMode" NOT NULL,
    "status" "CommercialAgreementStatus" NOT NULL DEFAULT 'PENDING',
    "subscriptionId" TEXT,
    "agreementValueMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentArrangement" "PaymentArrangement",
    "commissionRateBps" INTEGER NOT NULL,
    "commissionPolicy" "PartnerCommissionPolicy" NOT NULL DEFAULT 'RECURRING',
    "commissionEndDate" TIMESTAMP(3),
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

    CONSTRAINT "CommercialAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCommission" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "commercialAgreementId" TEXT NOT NULL,
    "platformInvoiceId" TEXT NOT NULL,
    "commercialMode" "CommercialMode" NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "eligibleAmountMinor" INTEGER NOT NULL,
    "commissionAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PartnerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCommissionReversal" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedById" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCommissionReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerWithdrawal" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PartnerWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "payoutReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerWithdrawalAllocation" (
    "withdrawalId" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerWithdrawalAllocation_pkey" PRIMARY KEY ("commissionId")
);

-- CreateTable
CREATE TABLE "PartnerCommissionConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "buyCommissionRateBps" INTEGER NOT NULL DEFAULT 2000,
    "rentCommissionRateBps" INTEGER NOT NULL DEFAULT 1300,
    "buyCommissionPolicy" "PartnerCommissionPolicy" NOT NULL DEFAULT 'RECURRING',
    "rentCommissionPolicy" "PartnerCommissionPolicy" NOT NULL DEFAULT 'RECURRING',
    "holdDays" INTEGER NOT NULL DEFAULT 7,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
    "minimumWithdrawalMinor" INTEGER NOT NULL DEFAULT 1000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PartnerCommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_partnerCode_key" ON "Partner"("partnerCode");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReferral_schoolId_key" ON "PartnerReferral"("schoolId");

-- CreateIndex
CREATE INDEX "PartnerReferral_partnerId_idx" ON "PartnerReferral"("partnerId");

-- CreateIndex
CREATE INDEX "CommercialAgreement_schoolId_idx" ON "CommercialAgreement"("schoolId");

-- CreateIndex
CREATE INDEX "CommercialAgreement_partnerId_idx" ON "CommercialAgreement"("partnerId");

-- CreateIndex
CREATE INDEX "CommercialAgreement_status_idx" ON "CommercialAgreement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCommission_platformInvoiceId_key" ON "PartnerCommission"("platformInvoiceId");

-- CreateIndex
CREATE INDEX "PartnerCommission_partnerId_status_idx" ON "PartnerCommission"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerCommission_schoolId_idx" ON "PartnerCommission"("schoolId");

-- CreateIndex
CREATE INDEX "PartnerCommission_commercialAgreementId_idx" ON "PartnerCommission"("commercialAgreementId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCommissionReversal_commissionId_key" ON "PartnerCommissionReversal"("commissionId");

-- CreateIndex
CREATE INDEX "PartnerWithdrawal_partnerId_status_idx" ON "PartnerWithdrawal"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerWithdrawalAllocation_withdrawalId_idx" ON "PartnerWithdrawalAllocation"("withdrawalId");

-- CreateIndex
CREATE INDEX "PlatformInvoice_commercialAgreementId_idx" ON "PlatformInvoice"("commercialAgreementId");

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_commercialAgreementId_fkey" FOREIGN KEY ("commercialAgreementId") REFERENCES "CommercialAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_attributedById_fkey" FOREIGN KEY ("attributedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialAgreement" ADD CONSTRAINT "CommercialAgreement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_commercialAgreementId_fkey" FOREIGN KEY ("commercialAgreementId") REFERENCES "CommercialAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_platformInvoiceId_fkey" FOREIGN KEY ("platformInvoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionReversal" ADD CONSTRAINT "PartnerCommissionReversal_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "PartnerCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommissionReversal" ADD CONSTRAINT "PartnerCommissionReversal_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWithdrawal" ADD CONSTRAINT "PartnerWithdrawal_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWithdrawalAllocation" ADD CONSTRAINT "PartnerWithdrawalAllocation_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "PartnerWithdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWithdrawalAllocation" ADD CONSTRAINT "PartnerWithdrawalAllocation_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "PartnerCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
