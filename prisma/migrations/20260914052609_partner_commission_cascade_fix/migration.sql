-- DropForeignKey
ALTER TABLE "PartnerCommissionReversal" DROP CONSTRAINT "PartnerCommissionReversal_commissionId_fkey";

-- DropForeignKey
ALTER TABLE "PartnerWithdrawalAllocation" DROP CONSTRAINT "PartnerWithdrawalAllocation_commissionId_fkey";

-- AddForeignKey
ALTER TABLE "PartnerCommissionReversal" ADD CONSTRAINT "PartnerCommissionReversal_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "PartnerCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerWithdrawalAllocation" ADD CONSTRAINT "PartnerWithdrawalAllocation_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "PartnerCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
