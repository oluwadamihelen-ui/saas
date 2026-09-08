-- CreateEnum
CREATE TYPE "BillingEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnterpriseInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DECLINED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TRIAL_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'TRIAL_ENDING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'TRIAL_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_PAYMENT_SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_RENEWED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'STUDENT_LIMIT_APPROACHING';
ALTER TYPE "NotificationType" ADD VALUE 'STUDENT_LIMIT_REACHED';
ALTER TYPE "NotificationType" ADD VALUE 'PLAN_UPGRADED';
ALTER TYPE "NotificationType" ADD VALUE 'PLAN_DOWNGRADED';

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';

-- AlterTable: PlatformInvoice (all new columns are nullable-or-defaulted, safe as-is)
ALTER TABLE "PlatformInvoice" ADD COLUMN     "billingInterval" "BillingInterval",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "provider" "PaymentGatewayProvider",
ADD COLUMN     "providerReference" TEXT;

-- AlterTable: Subscription (all new columns are nullable-or-defaulted, safe as-is)
ALTER TABLE "Subscription" ADD COLUMN     "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "provider" "PaymentGatewayProvider",
ADD COLUMN     "providerCustomerId" TEXT,
ADD COLUMN     "providerSubscriptionId" TEXT,
ADD COLUMN     "trialEnd" TIMESTAMP(3),
ADD COLUMN     "trialStart" TIMESTAMP(3);

-- AlterTable: SubscriptionPlan — add everything nullable first (slug/updatedAt
-- included) so existing rows aren't broken, backfill from the old
-- priceMinor/billingInterval columns, THEN tighten to NOT NULL, THEN drop
-- the old columns. Existing plan names (Starter/Growth/Enterprise from the
-- old 3-tier catalog) are re-mapped to the new 4-tier structure by slug so
-- any school already subscribed keeps a valid planId throughout.
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "isCustomPricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMostPopular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceAnnualMinor" INTEGER,
ADD COLUMN     "priceMonthlyMinor" INTEGER,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill priceMonthlyMinor/priceAnnualMinor from the old single price+interval.
UPDATE "SubscriptionPlan"
SET "priceMonthlyMinor" = CASE WHEN "billingInterval" = 'MONTHLY' THEN "priceMinor" ELSE "priceMonthlyMinor" END,
    "priceAnnualMinor"  = CASE WHEN "billingInterval" = 'YEARLY'  THEN "priceMinor" ELSE "priceAnnualMinor"  END;

-- Re-map known legacy plan names (from the old 3-tier DEFAULT_PLANS) onto the
-- new 4-tier catalog in place, so existing Subscription.planId rows stay valid.
UPDATE "SubscriptionPlan" SET
  "slug" = 'STARTER',
  "name" = 'Starter',
  "tagline" = 'For small schools getting started.',
  "priceMonthlyMinor" = 2500000,
  "priceAnnualMinor" = 25000000,
  "studentLimit" = 150,
  "isMostPopular" = false,
  "sortOrder" = 0
WHERE "name" = 'Starter';

UPDATE "SubscriptionPlan" SET
  "slug" = 'PROFESSIONAL',
  "name" = 'Professional',
  "tagline" = 'For growing schools.',
  "priceMonthlyMinor" = 6000000,
  "priceAnnualMinor" = 60000000,
  "studentLimit" = 500,
  "isMostPopular" = true,
  "sortOrder" = 1
WHERE "name" = 'Growth';

UPDATE "SubscriptionPlan" SET
  "slug" = 'PREMIUM',
  "name" = 'Premium',
  "tagline" = 'For established schools.',
  "priceMonthlyMinor" = 12000000,
  "priceAnnualMinor" = 120000000,
  "studentLimit" = 1500,
  "isMostPopular" = false,
  "sortOrder" = 2
WHERE "name" = 'Enterprise' AND "isCustomPricing" = false;

-- Any remaining plan row this migration hasn't matched by legacy name (a
-- school-owner-created custom plan, if the platform admin UI was used to
-- add one) gets a derived slug from its name so the NOT NULL/UNIQUE
-- constraint below never fails, rather than guessing which tier it means.
UPDATE "SubscriptionPlan"
SET "slug" = upper(regexp_replace("name", '[^a-zA-Z0-9]+', '_', 'g'))
WHERE "slug" IS NULL;

UPDATE "SubscriptionPlan" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

ALTER TABLE "SubscriptionPlan" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "SubscriptionPlan" DROP COLUMN "billingInterval",
DROP COLUMN "priceMinor";

-- Insert the new Enterprise (custom pricing) tier if it doesn't already exist.
INSERT INTO "SubscriptionPlan" ("id", "slug", "name", "tagline", "currency", "isCustomPricing", "studentLimit", "isMostPopular", "sortOrder", "isActive", "features", "createdAt", "updatedAt")
SELECT 'plan_enterprise_seed', 'ENTERPRISE', 'Enterprise', 'For large school groups.', 'NGN', true, NULL, false, 3, true, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "slug" = 'ENTERPRISE');

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schoolId" TEXT,
    "subscriptionId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "BillingEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseInquiry" (
    "id" TEXT NOT NULL,
    "schoolOrGroupName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "studentCount" INTEGER,
    "campusCount" INTEGER,
    "currentSoftware" TEXT,
    "requiredModules" TEXT,
    "message" TEXT,
    "status" "EnterpriseInquiryStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingEvent_schoolId_idx" ON "BillingEvent"("schoolId");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_provider_externalEventId_key" ON "BillingEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "EnterpriseInquiry_status_idx" ON "EnterpriseInquiry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_providerReference_key" ON "PlatformInvoice"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseInquiry" ADD CONSTRAINT "EnterpriseInquiry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
