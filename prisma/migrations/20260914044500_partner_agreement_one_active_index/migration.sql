-- Only one ACTIVE CommercialAgreement per school at a time. PENDING,
-- COMPLETED, SUPERSEDED and CANCELLED rows are deliberately excluded, so
-- a PENDING agreement may coexist with an already-ACTIVE one for the same
-- school (e.g. a BUY deal being prepared while RENT stays live).
CREATE UNIQUE INDEX "CommercialAgreement_one_active_per_school"
  ON "CommercialAgreement" ("schoolId")
  WHERE "status" = 'ACTIVE';
