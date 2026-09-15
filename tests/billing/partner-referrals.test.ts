import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";
import { createTestPartner, cleanupTestPartners } from "../helpers/partner-factories";
import { resolveActivePartnerByCode, manuallyAttributePartnerReferral, overridePartnerReferral } from "@/lib/services/partner-referrals";

afterAll(async () => {
  await cleanupTestPartners();
  await cleanupTestSchools();
});

describe("resolveActivePartnerByCode", () => {
  it("matches case-insensitively", async () => {
    const { partner } = await createTestPartner();
    const found = await resolveActivePartnerByCode(partner.partnerCode.toLowerCase());
    expect(found?.id).toBe(partner.id);
  });

  it("never resolves a non-ACTIVE partner's code", async () => {
    const { partner } = await createTestPartner({ status: "PENDING" });
    const found = await resolveActivePartnerByCode(partner.partnerCode);
    expect(found).toBeNull();
  });

  it("returns null for an unknown code", async () => {
    const found = await resolveActivePartnerByCode("NOSUCHCODE");
    expect(found).toBeNull();
  });
});

describe("manuallyAttributePartnerReferral", () => {
  it("creates the school's one-and-only referral row", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();

    const referral = await manuallyAttributePartnerReferral({ schoolId: school.id, partnerId: partner.id, attributedById: admin.id });
    expect(referral.source).toBe("MANUAL");
    expect(referral.partnerId).toBe(partner.id);
  });

  it("refuses to attribute a school that already has a referral", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    await manuallyAttributePartnerReferral({ schoolId: school.id, partnerId: partner.id, attributedById: admin.id });

    await expect(manuallyAttributePartnerReferral({ schoolId: school.id, partnerId: partner.id, attributedById: admin.id })).rejects.toThrow();
  });
});

describe("overridePartnerReferral", () => {
  it("requires a reason, an existing referral, and a genuinely different partner", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner: partnerA, user: admin } = await createTestPartner();
    const { partner: partnerB } = await createTestPartner();

    await expect(
      overridePartnerReferral({ schoolId: school.id, newPartnerId: partnerB.id, overriddenById: admin.id, reason: "no referral yet" })
    ).rejects.toThrow();

    await manuallyAttributePartnerReferral({ schoolId: school.id, partnerId: partnerA.id, attributedById: admin.id });

    await expect(
      overridePartnerReferral({ schoolId: school.id, newPartnerId: partnerA.id, overriddenById: admin.id, reason: "same partner" })
    ).rejects.toThrow();
    await expect(
      overridePartnerReferral({ schoolId: school.id, newPartnerId: partnerB.id, overriddenById: admin.id, reason: "" })
    ).rejects.toThrow();
  });

  it("updates the same row, recording previousPartnerId/overriddenAt/overriddenById/overrideReason", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner: partnerA, user: admin } = await createTestPartner();
    const { partner: partnerB } = await createTestPartner();
    const original = await manuallyAttributePartnerReferral({ schoolId: school.id, partnerId: partnerA.id, attributedById: admin.id });

    const overridden = await overridePartnerReferral({ schoolId: school.id, newPartnerId: partnerB.id, overriddenById: admin.id, reason: "Correction" });
    expect(overridden.id).toBe(original.id);
    expect(overridden.partnerId).toBe(partnerB.id);
    expect(overridden.previousPartnerId).toBe(partnerA.id);
    expect(overridden.overrideReason).toBe("Correction");

    const allReferralsForSchool = await prisma.partnerReferral.findMany({ where: { schoolId: school.id } });
    expect(allReferralsForSchool).toHaveLength(1);
  });
});
