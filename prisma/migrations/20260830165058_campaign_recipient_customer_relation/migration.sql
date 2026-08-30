-- CreateIndex
CREATE INDEX "CampaignRecipient_customerId_idx" ON "CampaignRecipient"("customerId");

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
