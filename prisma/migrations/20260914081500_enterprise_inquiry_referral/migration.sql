-- AlterTable
ALTER TABLE "EnterpriseInquiry" ADD COLUMN     "referralCodeUsed" TEXT,
ADD COLUMN     "referredByPartnerId" TEXT;

-- AddForeignKey
ALTER TABLE "EnterpriseInquiry" ADD CONSTRAINT "EnterpriseInquiry_referredByPartnerId_fkey" FOREIGN KEY ("referredByPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

