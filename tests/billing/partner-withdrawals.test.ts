import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";
import { createTestPartner, cleanupTestPartners } from "../helpers/partner-factories";
import {
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  cancelWithdrawal,
  getPartnerBalance,
} from "@/lib/services/partner-withdrawals";

afterAll(async () => {
  await cleanupTestPartners();
  await cleanupTestSchools();
});

async function makeAvailableCommission(schoolId: string, partnerId: string, amountMinor: number) {
  const now = new Date();
  const invoice = await prisma.platformInvoice.create({
    data: { schoolId, periodStart: now, periodEnd: now, amountMinor, dueDate: now, status: "PAID", paidAt: now },
  });
  return prisma.partnerCommission.create({
    data: {
      partnerId,
      schoolId,
      // status: PENDING (not ACTIVE) — this test only needs a valid FK
      // parent for the commission row, and the partial unique index only
      // allows one ACTIVE CommercialAgreement per school at a time, which
      // a helper called multiple times per school/test would collide with.
      commercialAgreementId: (
        await prisma.commercialAgreement.create({
          data: { schoolId, partnerId, commercialMode: "BUY", status: "PENDING", commissionRateBps: 2000, currency: "NGN" },
        })
      ).id,
      platformInvoiceId: invoice.id,
      commercialMode: "BUY",
      commissionRateBps: 2000,
      eligibleAmountMinor: amountMinor,
      commissionAmountMinor: amountMinor,
      status: "AVAILABLE",
      availableAt: new Date(Date.now() - 1000),
    },
  });
}

describe("requestWithdrawal", () => {
  it("throws when there is no available balance", async () => {
    const { partner } = await createTestPartner();
    await expect(requestWithdrawal(partner.id)).rejects.toThrow();
  });

  it("throws when the available balance is below the minimum withdrawal", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    await makeAvailableCommission(school.id, partner.id, 100_00);
    await expect(requestWithdrawal(partner.id)).rejects.toThrow();
  });

  it("sums every AVAILABLE commission, reserves them, and creates the allocation rows", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const c1 = await makeAvailableCommission(school.id, partner.id, 1_500_000_00);
    const c2 = await makeAvailableCommission(school.id, partner.id, 500_000_00);

    const withdrawal = await requestWithdrawal(partner.id);
    expect(withdrawal.amountMinor).toBe(2_000_000_00);
    expect(withdrawal.status).toBe("REQUESTED");

    const updated1 = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: c1.id } });
    const updated2 = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: c2.id } });
    expect(updated1.status).toBe("RESERVED");
    expect(updated2.status).toBe("RESERVED");

    const allocations = await prisma.partnerWithdrawalAllocation.findMany({ where: { withdrawalId: withdrawal.id } });
    expect(allocations.map((a) => a.commissionId).sort()).toEqual([c1.id, c2.id].sort());

    // A second request immediately after has nothing left to withdraw.
    await expect(requestWithdrawal(partner.id)).rejects.toThrow();
  });

  it("never pulls in another partner's commissions", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner: partnerA } = await createTestPartner();
    const { partner: partnerB } = await createTestPartner();
    await makeAvailableCommission(school.id, partnerA.id, 2_000_000_00);
    await makeAvailableCommission(school.id, partnerB.id, 2_000_000_00);

    const withdrawal = await requestWithdrawal(partnerA.id);
    expect(withdrawal.amountMinor).toBe(2_000_000_00);

    const balanceB = await getPartnerBalance(partnerB.id);
    expect(balanceB.availableMinor).toBe(2_000_000_00);
  });
});

describe("withdrawal review flow", () => {
  it("reject releases allocations back to AVAILABLE", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const commission = await makeAvailableCommission(school.id, partner.id, 2_000_000_00);
    const withdrawal = await requestWithdrawal(partner.id);

    const rejected = await rejectWithdrawal(withdrawal.id, admin.id, "Bank details unverified");
    expect(rejected.status).toBe("REJECTED");

    const restoredCommission = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(restoredCommission.status).toBe("AVAILABLE");
    const allocations = await prisma.partnerWithdrawalAllocation.findMany({ where: { withdrawalId: withdrawal.id } });
    expect(allocations).toHaveLength(0);
  });

  it("approve then markPaid flips the allocated commissions to PAID permanently", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const commission = await makeAvailableCommission(school.id, partner.id, 2_000_000_00);
    const withdrawal = await requestWithdrawal(partner.id);

    await approveWithdrawal(withdrawal.id, admin.id);
    const paid = await markWithdrawalPaid(withdrawal.id, admin.id, "TXN-REF-123");
    expect(paid.status).toBe("PAID");
    expect(paid.payoutReference).toBe("TXN-REF-123");

    const paidCommission = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(paidCommission.status).toBe("PAID");
  });

  it("markWithdrawalPaid refuses a withdrawal that isn't APPROVED", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    await makeAvailableCommission(school.id, partner.id, 2_000_000_00);
    const withdrawal = await requestWithdrawal(partner.id);

    await expect(markWithdrawalPaid(withdrawal.id, admin.id, "TXN-REF")).rejects.toThrow();
  });
});

describe("cancelWithdrawal", () => {
  it("lets a Partner cancel their own still-open request, releasing its allocations", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    const commission = await makeAvailableCommission(school.id, partner.id, 2_000_000_00);
    const withdrawal = await requestWithdrawal(partner.id);

    const cancelled = await cancelWithdrawal(withdrawal.id, partner.id);
    expect(cancelled.status).toBe("CANCELLED");

    const restoredCommission = await prisma.partnerCommission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(restoredCommission.status).toBe("AVAILABLE");
  });

  it("refuses to cancel another Partner's withdrawal", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner: owner } = await createTestPartner();
    const { partner: intruder } = await createTestPartner();
    await makeAvailableCommission(school.id, owner.id, 2_000_000_00);
    const withdrawal = await requestWithdrawal(owner.id);

    await expect(cancelWithdrawal(withdrawal.id, intruder.id)).rejects.toThrow();
  });
});
