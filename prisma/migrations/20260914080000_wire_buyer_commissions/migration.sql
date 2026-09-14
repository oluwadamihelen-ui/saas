-- DropForeignKey
ALTER TABLE "PartnerCommission" DROP CONSTRAINT "PartnerCommission_commercialAgreementId_fkey";

-- DropForeignKey
ALTER TABLE "PartnerCommission" DROP CONSTRAINT "PartnerCommission_platformInvoiceId_fkey";

-- AlterTable
-- commissionRateBps is added nullable and backfilled below, not NOT NULL
-- up front — BuyerAgreement is a pre-existing table that may already hold
-- real rows in production (the Buyer Program shipped before this
-- migration), and a bare NOT NULL ADD COLUMN fails outright against any
-- existing row.
ALTER TABLE "BuyerAgreement" ADD COLUMN     "commissionEndDate" TIMESTAMP(3),
ADD COLUMN     "commissionPolicy" "PartnerCommissionPolicy" NOT NULL DEFAULT 'RECURRING',
ADD COLUMN     "commissionRateBps" INTEGER,
ADD COLUMN     "partnerId" TEXT;

-- Backfill any pre-existing BuyerAgreement rows with today's global BUY
-- rate (they predate per-agreement rate snapshotting and were never
-- attached to a Partner anyway, so the exact value is inert — it only
-- needs to be non-null to satisfy the NOT NULL below). Falls back to the
-- schema's own default of 2000 bps if PartnerCommissionConfig has never
-- been seeded in this environment.
UPDATE "BuyerAgreement" SET "commissionRateBps" = COALESCE(
  (SELECT "buyCommissionRateBps" FROM "PartnerCommissionConfig" WHERE "id" = 'default'),
  2000
) WHERE "commissionRateBps" IS NULL;

ALTER TABLE "BuyerAgreement" ALTER COLUMN "commissionRateBps" SET NOT NULL;

-- AlterTable
ALTER TABLE "PartnerCommission" ADD COLUMN     "buyerAgreementId" TEXT,
ADD COLUMN     "buyerId" TEXT,
ADD COLUMN     "buyerInvoiceId" TEXT,
ALTER COLUMN "schoolId" DROP NOT NULL,
ALTER COLUMN "commercialAgreementId" DROP NOT NULL,
ALTER COLUMN "platformInvoiceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PartnerReferral" ADD COLUMN     "buyerId" TEXT,
ALTER COLUMN "schoolId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BuyerAgreement_partnerId_idx" ON "BuyerAgreement"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCommission_buyerInvoiceId_key" ON "PartnerCommission"("buyerInvoiceId");

-- CreateIndex
CREATE INDEX "PartnerCommission_buyerId_idx" ON "PartnerCommission"("buyerId");

-- CreateIndex
CREATE INDEX "PartnerCommission_buyerAgreementId_idx" ON "PartnerCommission"("buyerAgreementId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReferral_buyerId_key" ON "PartnerReferral"("buyerId");

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_commercialAgreementId_fkey" FOREIGN KEY ("commercialAgreementId") REFERENCES "CommercialAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_platformInvoiceId_fkey" FOREIGN KEY ("platformInvoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_buyerAgreementId_fkey" FOREIGN KEY ("buyerAgreementId") REFERENCES "BuyerAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_buyerInvoiceId_fkey" FOREIGN KEY ("buyerInvoiceId") REFERENCES "BuyerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerAgreement" ADD CONSTRAINT "BuyerAgreement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A referral (and, likewise, a commission) always comes from exactly one
-- of the two commercial relationships this app has: a School, or a
-- standalone Buyer (see Buyer's own doc comment on why the two are
-- mutually exclusive). Enforced here, not just in application code.
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_exactly_one_target" CHECK (
  (("schoolId" IS NOT NULL)::int + ("buyerId" IS NOT NULL)::int) = 1
);

ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_exactly_one_target" CHECK (
  (("schoolId" IS NOT NULL)::int + ("buyerId" IS NOT NULL)::int) = 1
  AND (("platformInvoiceId" IS NOT NULL)::int + ("buyerInvoiceId" IS NOT NULL)::int) = 1
);
