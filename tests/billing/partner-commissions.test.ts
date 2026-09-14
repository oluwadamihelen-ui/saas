import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";
import { createTestPartner, cleanupTestPartners } from "../helpers/partner-factories";
import { createPartnerCommissionForInvoice, reversePartnerCommission, reconcilePartnerCommissions, getPartnerCommissionConfig } from "@/lib/services/partner-commissions";
import type { PartnerCommissionPolicy } from "@/generated/prisma/client";

afterAll(async () => {
  await cleanupTestPartners();
  await cleanupTestSchools();
});

async function makeAgreement(
  schoolId: string,
  partnerId: string | null,
  overrides: { commissionRateBps?: number; commissionPolicy?: PartnerCommissionPolicy; commissionEndDate?: Date } = {}
) {
  return prisma.commercialAgreement.create({
    data: {
      schoolId,
      partnerId,
      commercialMode: "BUY",
      status: "ACTIVE",
      commissionRateBps: overrides.commissionRateBps ?? 2000,
      commissionPolicy: overrides.commissionPolicy,
      commissionEndDate: overrides.commissionEndDate,
      currency: "NGN",
    },
  });
}

async function makeInvoice(schoolId: string, commercialAgreementId: string | null, amountMinor = 100_000_00) {
  const now = new Date();
  return prisma.platformInvoice.create({
    data: {
      schoolId,
      commercialAgreementId,
      periodStart: now,
      periodEnd: now,
      amountMinor,
      dueDate: now,
      status: "PAID",
      paidAt: now,
    },
  });
}

describe("createPartnerCommissionForInvoice", () => {
  it("returns null when the invoice has no commercial agreement", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const invoice = await makeInvoice(school.id, null);
    const commission = await createPartnerCommissionForInvoice(invoice.id);
    expect(commission).toBeNull();
  });

  it("returns null when the agreement has no partner attached", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const agreement = await makeAgreement(school.id, null);
    const invoice = await makeInvoice(school.id, agreement.id);
    const commission = await createPartnerCommissionForInvoice(invoice.id);
    expect(commission).toBeNull();
  });

  it("creates a commission at the agreement's snapshotted rate", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id, { commissionRateBps: 2000 });
    const invoice = await makeInvoice(school.id, agreement.id, 100_000_00);

    const commission = await createPartnerCommissionForInvoice(invoice.id);
    expect(commission).not.toBeNull();
    expect(commission!.commissionAmountMinor).toBe(20_000_00);
    expect(commission!.eligibleAmountMinor).toBe(100_000_00);
    expect(commission!.status).toBe("PENDING");
    expect(commission!.partnerId).toBe(partner.id);
  });

  it("changing the global config never alters an already-snapshotted rate", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id, { commissionRateBps: 2000 });

    const config = await getPartnerCommissionConfig();
    await prisma.partnerCommissionConfig.update({ where: { id: config.id }, data: { buyCommissionRateBps: 5000 } });

    const invoice = await makeInvoice(school.id, agreement.id, 100_000_00);
    const commission = await createPartnerCommissionForInvoice(invoice.id);
    expect(commission!.commissionAmountMinor).toBe(20_000_00);

    await prisma.partnerCommissionConfig.update({ where: { id: config.id }, data: { buyCommissionRateBps: 2000 } });
  });

  it("is idempotent — calling it twice for the same invoice never creates a second commission", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id);
    const invoice = await makeInvoice(school.id, agreement.id);

    const first = await createPartnerCommissionForInvoice(invoice.id);
    const second = await createPartnerCommissionForInvoice(invoice.id);
    expect(second!.id).toBe(first!.id);

    const all = await prisma.partnerCommission.findMany({ where: { platformInvoiceId: invoice.id } });
    expect(all).toHaveLength(1);
  });

  it("FIRST_PAYMENT_ONLY policy skips every commission after the first", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id, { commissionPolicy: "FIRST_PAYMENT_ONLY" });

    const invoice1 = await makeInvoice(school.id, agreement.id);
    const invoice2 = await makeInvoice(school.id, agreement.id);

    const first = await createPartnerCommissionForInvoice(invoice1.id);
    const second = await createPartnerCommissionForInvoice(invoice2.id);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("RECURRING policy (default) earns a commission on every confirmed invoice", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id, { commissionPolicy: "RECURRING" });

    const invoice1 = await makeInvoice(school.id, agreement.id);
    const invoice2 = await makeInvoice(school.id, agreement.id);

    const first = await createPartnerCommissionForInvoice(invoice1.id);
    const second = await createPartnerCommissionForInvoice(invoice2.id);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it("skips creating a commission once commissionEndDate has passed", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const yesterday = new Date(Date.now() - 86_400_000);
    const agreement = await makeAgreement(school.id, partner.id, { commissionEndDate: yesterday });
    const invoice = await makeInvoice(school.id, agreement.id);

    const commission = await createPartnerCommissionForInvoice(invoice.id);
    expect(commission).toBeNull();
  });

  it("snapshots availableAt from the config's holdDays at creation time", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id);
    const invoice = await makeInvoice(school.id, agreement.id);

    const config = await getPartnerCommissionConfig();
    const commission = await createPartnerCommissionForInvoice(invoice.id);
    const expectedMs = commission!.earnedAt.getTime() + config.holdDays * 86_400_000;
    expect(Math.abs(commission!.availableAt.getTime() - expectedMs)).toBeLessThan(1000);
  });
});

describe("reconcilePartnerCommissions", () => {
  it("flips PENDING commissions to AVAILABLE once availableAt has passed, and leaves future ones alone", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id);

    const past = await prisma.partnerCommission.create({
      data: {
        partnerId: partner.id,
        schoolId: school.id,
        commercialAgreementId: agreement.id,
        platformInvoiceId: (await makeInvoice(school.id, agreement.id)).id,
        commercialMode: "BUY",
        commissionRateBps: 2000,
        eligibleAmountMinor: 100_000_00,
        commissionAmountMinor: 20_000_00,
        availableAt: new Date(Date.now() - 1000),
      },
    });
    const future = await prisma.partnerCommission.create({
      data: {
        partnerId: partner.id,
        schoolId: school.id,
        commercialAgreementId: agreement.id,
        platformInvoiceId: (await makeInvoice(school.id, agreement.id)).id,
        commercialMode: "BUY",
        commissionRateBps: 2000,
        eligibleAmountMinor: 100_000_00,
        commissionAmountMinor: 20_000_00,
        availableAt: new Date(Date.now() + 86_400_000),
      },
    });

    await reconcilePartnerCommissions(partner.id);

    const updatedPast = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: past.id } });
    const updatedFuture = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: future.id } });
    expect(updatedPast.status).toBe("AVAILABLE");
    expect(updatedFuture.status).toBe("PENDING");
  });
});

describe("reversePartnerCommission", () => {
  it("flips status to REVERSED and creates a PartnerCommissionReversal, without editing the original amount", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: superAdminStandIn } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id);
    const invoice = await makeInvoice(school.id, agreement.id);
    const commission = await createPartnerCommissionForInvoice(invoice.id);

    const reversed = await reversePartnerCommission({ commissionId: commission!.id, reversedById: superAdminStandIn.id, reason: "Refunded to school" });
    expect(reversed.status).toBe("REVERSED");
    expect(reversed.commissionAmountMinor).toBe(commission!.commissionAmountMinor);

    const reversal = await prisma.partnerCommissionReversal.findUnique({ where: { commissionId: commission!.id } });
    expect(reversal?.reason).toBe("Refunded to school");

    await expect(reversePartnerCommission({ commissionId: commission!.id, reversedById: superAdminStandIn.id, reason: "again" })).rejects.toThrow();
  });

  it("requires a non-empty reason", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user } = await createTestPartner();
    const agreement = await makeAgreement(school.id, partner.id);
    const invoice = await makeInvoice(school.id, agreement.id);
    const commission = await createPartnerCommissionForInvoice(invoice.id);

    await expect(reversePartnerCommission({ commissionId: commission!.id, reversedById: user.id, reason: "  " })).rejects.toThrow();
  });
});
