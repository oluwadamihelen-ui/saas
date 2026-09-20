-- Only one ACTIVE BuyerAgreement per Buyer at a time — same reasoning as
-- CommercialAgreement's own one-active-per-school index. PENDING/COMPLETED/
-- CANCELLED rows are deliberately excluded.
CREATE UNIQUE INDEX "BuyerAgreement_one_active_per_buyer"
  ON "BuyerAgreement" ("buyerId")
  WHERE "status" = 'ACTIVE';
