import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestSchool, cleanupTestSchools } from "../helpers/factories";
import { createTestPartner, cleanupTestPartners } from "../helpers/partner-factories";
import {
  createCommercialAgreement,
  approveAndActivateCommercialAgreement,
  cancelCommercialAgreement,
  markCommercialAgreementCompleted,
  createBuyInstallmentInvoice,
  canCreateInvoice,
  getOrCreateRentAgreementForInvoice,
} from "@/lib/services/partner-agreements";

afterAll(async () => {
  await cleanupTestPartners();
  await cleanupTestSchools();
});

describe("canCreateInvoice", () => {
  it("is true only for ACTIVE", () => {
    expect(canCreateInvoice({ status: "ACTIVE" })).toBe(true);
    expect(canCreateInvoice({ status: "PENDING" })).toBe(false);
    expect(canCreateInvoice({ status: "COMPLETED" })).toBe(false);
    expect(canCreateInvoice({ status: "SUPERSEDED" })).toBe(false);
    expect(canCreateInvoice({ status: "CANCELLED" })).toBe(false);
  });
});

describe("createCommercialAgreement", () => {
  it("rejects a BUY agreement carrying a subscriptionId", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const { user } = await createTestPartner();
    await expect(
      createCommercialAgreement({ schoolId: school.id, commercialMode: "BUY", subscriptionId: subscription.id, createdById: user.id })
    ).rejects.toThrow();
  });

  it("rejects a RENT agreement with no subscriptionId", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { user } = await createTestPartner();
    await expect(createCommercialAgreement({ schoolId: school.id, commercialMode: "RENT", createdById: user.id })).rejects.toThrow();
  });

  it("creates a PENDING agreement snapshotting the current config's rate", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user } = await createTestPartner();
    const agreement = await createCommercialAgreement({
      schoolId: school.id,
      partnerId: partner.id,
      commercialMode: "BUY",
      agreementValueMinor: 300_000_000,
      createdById: user.id,
    });
    expect(agreement.status).toBe("PENDING");
    expect(agreement.commissionRateBps).toBeGreaterThan(0);
  });
});

describe("approveAndActivateCommercialAgreement", () => {
  it("activates a PENDING BUY agreement atomically", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const agreement = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });

    const activated = await approveAndActivateCommercialAgreement({ agreementId: agreement.id, approvedById: admin.id });
    expect(activated.status).toBe("ACTIVE");
    expect(activated.approvedById).toBe(admin.id);
    expect(activated.activatedById).toBe(admin.id);
    expect(activated.startedAt).not.toBeNull();
  });

  it("rejects approving an agreement that isn't PENDING", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const agreement = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });
    await approveAndActivateCommercialAgreement({ agreementId: agreement.id, approvedById: admin.id });

    await expect(approveAndActivateCommercialAgreement({ agreementId: agreement.id, approvedById: admin.id })).rejects.toThrow();
  });

  it("RENT->BUY transition: supersedes the active RENT agreement and, by default, stops its Subscription", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();

    const rent = await createCommercialAgreement({
      schoolId: school.id,
      partnerId: partner.id,
      commercialMode: "RENT",
      subscriptionId: subscription.id,
      createdById: admin.id,
    });
    await approveAndActivateCommercialAgreement({ agreementId: rent.id, approvedById: admin.id });

    const buy = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });
    const activatedBuy = await approveAndActivateCommercialAgreement({ agreementId: buy.id, approvedById: admin.id });
    expect(activatedBuy.status).toBe("ACTIVE");

    const supersededRent = await prisma.commercialAgreement.findUniqueOrThrow({ where: { id: rent.id } });
    expect(supersededRent.status).toBe("SUPERSEDED");
    expect(supersededRent.endedAt).not.toBeNull();

    const updatedSubscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(updatedSubscription.status).toBe("CANCELED");
  });

  it("stopRentSubscription:false supersedes RENT but leaves the Subscription alone", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();

    const rent = await createCommercialAgreement({
      schoolId: school.id,
      partnerId: partner.id,
      commercialMode: "RENT",
      subscriptionId: subscription.id,
      createdById: admin.id,
    });
    await approveAndActivateCommercialAgreement({ agreementId: rent.id, approvedById: admin.id });

    const buy = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });
    await approveAndActivateCommercialAgreement({ agreementId: buy.id, approvedById: admin.id, stopRentSubscription: false });

    const updatedSubscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(updatedSubscription.status).toBe("ACTIVE");
  });
});

describe("cancelCommercialAgreement", () => {
  it("requires a reason and never touches an already-closed agreement", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const agreement = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });

    await expect(cancelCommercialAgreement({ agreementId: agreement.id, cancelledById: admin.id, reason: "" })).rejects.toThrow();

    const cancelled = await cancelCommercialAgreement({ agreementId: agreement.id, cancelledById: admin.id, reason: "Deal fell through" });
    expect(cancelled.status).toBe("CANCELLED");

    await expect(cancelCommercialAgreement({ agreementId: agreement.id, cancelledById: admin.id, reason: "again" })).rejects.toThrow();
  });
});

describe("markCommercialAgreementCompleted", () => {
  it("only completes an ACTIVE agreement", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const agreement = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });

    await expect(markCommercialAgreementCompleted({ agreementId: agreement.id, completedById: admin.id })).rejects.toThrow();

    await approveAndActivateCommercialAgreement({ agreementId: agreement.id, approvedById: admin.id });
    const completed = await markCommercialAgreementCompleted({ agreementId: agreement.id, completedById: admin.id });
    expect(completed.status).toBe("COMPLETED");
  });
});

describe("createBuyInstallmentInvoice", () => {
  it("refuses to create an invoice for a non-ACTIVE agreement", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const agreement = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });

    await expect(
      createBuyInstallmentInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id })
    ).rejects.toThrow();
  });

  it("creates the invoice linked to the agreement once ACTIVE", async () => {
    const { school } = await createTestSchool({ planTier: "STARTER" });
    const { partner, user: admin } = await createTestPartner();
    const agreement = await createCommercialAgreement({ schoolId: school.id, partnerId: partner.id, commercialMode: "BUY", createdById: admin.id });
    await approveAndActivateCommercialAgreement({ agreementId: agreement.id, approvedById: admin.id });

    const invoice = await createBuyInstallmentInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id });
    expect(invoice.commercialAgreementId).toBe(agreement.id);
    expect(invoice.subscriptionId).toBeNull();
  });
});

describe("getOrCreateRentAgreementForInvoice", () => {
  it("returns null for a school with no Partner referral", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const id = await getOrCreateRentAgreementForInvoice(school.id, subscription.id);
    expect(id).toBeNull();
  });

  it("auto-creates an ACTIVE RENT agreement when a referral exists, and reuses it on a second call", async () => {
    const { school, subscription } = await createTestSchool({ planTier: "STARTER" });
    const { partner } = await createTestPartner();
    await prisma.partnerReferral.create({ data: { partnerId: partner.id, schoolId: school.id, source: "LINK", referralCodeUsed: partner.partnerCode } });

    const firstId = await getOrCreateRentAgreementForInvoice(school.id, subscription.id);
    expect(firstId).not.toBeNull();
    const agreement = await prisma.commercialAgreement.findUniqueOrThrow({ where: { id: firstId! } });
    expect(agreement.status).toBe("ACTIVE");
    expect(agreement.commercialMode).toBe("RENT");

    const secondId = await getOrCreateRentAgreementForInvoice(school.id, subscription.id);
    expect(secondId).toBe(firstId);

    const allRentAgreements = await prisma.commercialAgreement.findMany({ where: { schoolId: school.id } });
    expect(allRentAgreements).toHaveLength(1);
  });
});
