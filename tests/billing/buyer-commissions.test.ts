import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestBuyer, cleanupTestBuyers } from "../helpers/buyer-factories";
import { createTestPartner, cleanupTestPartners } from "../helpers/partner-factories";
import { manuallyAttributeBuyerReferral, overrideBuyerReferral } from "@/lib/services/partner-referrals";
import { createBuyerAgreement, approveAndActivateBuyerAgreement } from "@/lib/services/buyer-agreements";
import { createBuyerInvoice, markBuyerInvoicePaid } from "@/lib/services/buyer-invoices";
import { createPartnerCommissionForBuyerInvoice, getPartnerCommissionConfig } from "@/lib/services/partner-commissions";
import { confirmBuyerInvoicePayment, initializeBuyerInvoicePayment } from "@/lib/billing/payment-provider";
import { convertInquiryToBuyer } from "@/lib/services/buyer-onboarding";
import { createEnterpriseInquiry } from "@/lib/services/enterprise-inquiries";
import type { PartnerCommissionPolicy } from "@/generated/prisma/client";

afterAll(async () => {
  await cleanupTestPartners();
  await cleanupTestBuyers();
});

async function makeAgreement(
  buyerId: string,
  createdById: string,
  partnerId: string | null,
  overrides: { commissionPolicy?: PartnerCommissionPolicy; commissionEndDate?: Date } = {}
) {
  const agreement = await createBuyerAgreement({ buyerId, partnerId, createdById });
  await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: createdById });
  if (overrides.commissionPolicy || overrides.commissionEndDate) {
    return prisma.buyerAgreement.update({
      where: { id: agreement.id },
      data: { commissionPolicy: overrides.commissionPolicy, commissionEndDate: overrides.commissionEndDate },
    });
  }
  return agreement;
}

async function makePaidInvoice(agreementId: string, createdById: string, amountMinor = 100_000_00) {
  const invoice = await createBuyerInvoice({ agreementId, amountMinor, dueDate: new Date(), createdById });
  return markBuyerInvoicePaid(invoice.id, createdById);
}

describe("manuallyAttributeBuyerReferral", () => {
  it("creates the buyer's one-and-only referral row", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();

    const referral = await manuallyAttributeBuyerReferral({ buyerId: buyer.id, partnerId: partner.id, attributedById: admin.id });
    expect(referral.source).toBe("MANUAL");
    expect(referral.partnerId).toBe(partner.id);
    expect(referral.buyerId).toBe(buyer.id);
  });

  it("refuses to attribute a buyer that already has a referral", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    await manuallyAttributeBuyerReferral({ buyerId: buyer.id, partnerId: partner.id, attributedById: admin.id });

    await expect(manuallyAttributeBuyerReferral({ buyerId: buyer.id, partnerId: partner.id, attributedById: admin.id })).rejects.toThrow();
  });
});

describe("overrideBuyerReferral", () => {
  it("requires a reason, an existing referral, and a genuinely different partner", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner: partnerA } = await createTestPartner();
    const { partner: partnerB } = await createTestPartner();

    await expect(
      overrideBuyerReferral({ buyerId: buyer.id, newPartnerId: partnerB.id, overriddenById: admin.id, reason: "no referral yet" })
    ).rejects.toThrow();

    await manuallyAttributeBuyerReferral({ buyerId: buyer.id, partnerId: partnerA.id, attributedById: admin.id });

    await expect(
      overrideBuyerReferral({ buyerId: buyer.id, newPartnerId: partnerA.id, overriddenById: admin.id, reason: "same partner" })
    ).rejects.toThrow();
    await expect(
      overrideBuyerReferral({ buyerId: buyer.id, newPartnerId: partnerB.id, overriddenById: admin.id, reason: "" })
    ).rejects.toThrow();
  });

  it("updates the same row, recording previousPartnerId/overriddenAt/overriddenById/overrideReason", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner: partnerA } = await createTestPartner();
    const { partner: partnerB } = await createTestPartner();
    const original = await manuallyAttributeBuyerReferral({ buyerId: buyer.id, partnerId: partnerA.id, attributedById: admin.id });

    const overridden = await overrideBuyerReferral({ buyerId: buyer.id, newPartnerId: partnerB.id, overriddenById: admin.id, reason: "Correction" });
    expect(overridden.id).toBe(original.id);
    expect(overridden.partnerId).toBe(partnerB.id);
    expect(overridden.previousPartnerId).toBe(partnerA.id);
    expect(overridden.overrideReason).toBe("Correction");

    const allReferralsForBuyer = await prisma.partnerReferral.findMany({ where: { buyerId: buyer.id } });
    expect(allReferralsForBuyer).toHaveLength(1);
  });
});

describe("convertInquiryToBuyer referral attribution", () => {
  it("attributes the Buyer to the Partner captured on the inquiry at submission time", async () => {
    const { partner } = await createTestPartner();
    const suffix = `${Date.now()}-${Math.random()}`;
    const inquiry = await createEnterpriseInquiry({
      schoolOrGroupName: `Referred Buyer Co ${suffix}`,
      contactName: `Referred Contact ${suffix}`,
      email: `vitest-buyer-referred-${suffix}@example.com`,
      phone: "+2340000000000",
      referredByPartnerId: partner.id,
      referralCodeUsed: partner.partnerCode,
    });
    const admin = (await createTestBuyer()).user;

    const result = await convertInquiryToBuyer({ inquiryId: inquiry.id, createdById: admin.id, displayName: "Referred Buyer Co" });

    const referral = await prisma.partnerReferral.findUnique({ where: { buyerId: result.buyer.id } });
    expect(referral?.partnerId).toBe(partner.id);
    expect(referral?.source).toBe("LINK");
    expect(referral?.referralCodeUsed).toBe(partner.partnerCode);
  });

  it("does not attribute a referral when the captured Partner is no longer ACTIVE", async () => {
    const { partner } = await createTestPartner({ status: "SUSPENDED" });
    const suffix = `${Date.now()}-${Math.random()}`;
    const inquiry = await createEnterpriseInquiry({
      schoolOrGroupName: `Suspended Referrer Co ${suffix}`,
      contactName: `Suspended Contact ${suffix}`,
      email: `vitest-buyer-suspended-ref-${suffix}@example.com`,
      phone: "+2340000000000",
      referredByPartnerId: partner.id,
      referralCodeUsed: partner.partnerCode,
    });
    const admin = (await createTestBuyer()).user;

    const result = await convertInquiryToBuyer({ inquiryId: inquiry.id, createdById: admin.id, displayName: "Suspended Referrer Co" });

    const referral = await prisma.partnerReferral.findUnique({ where: { buyerId: result.buyer.id } });
    expect(referral).toBeNull();
  });
});

describe("createPartnerCommissionForBuyerInvoice", () => {
  it("returns null when the agreement has no partner attached", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await makeAgreement(buyer.id, admin.id, null);
    const invoice = await makePaidInvoice(agreement.id, admin.id);

    const commission = await createPartnerCommissionForBuyerInvoice(invoice.id);
    expect(commission).toBeNull();
  });

  it("creates a commission at the agreement's snapshotted BUY rate", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(buyer.id, admin.id, partner.id);
    const invoice = await makePaidInvoice(agreement.id, admin.id, 100_000_00);

    const config = await getPartnerCommissionConfig();
    const commission = await createPartnerCommissionForBuyerInvoice(invoice.id);
    expect(commission).not.toBeNull();
    expect(commission!.partnerId).toBe(partner.id);
    expect(commission!.buyerId).toBe(buyer.id);
    expect(commission!.buyerAgreementId).toBe(agreement.id);
    expect(commission!.buyerInvoiceId).toBe(invoice.id);
    expect(commission!.schoolId).toBeNull();
    expect(commission!.commercialMode).toBe("BUY");
    expect(commission!.commissionRateBps).toBe(config.buyCommissionRateBps);
    expect(commission!.commissionAmountMinor).toBe(Math.round((100_000_00 * config.buyCommissionRateBps) / 10000));
    expect(commission!.status).toBe("PENDING");
  });

  it("is idempotent — calling it twice for the same invoice never creates a second commission", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(buyer.id, admin.id, partner.id);
    const invoice = await makePaidInvoice(agreement.id, admin.id);

    const first = await createPartnerCommissionForBuyerInvoice(invoice.id);
    const second = await createPartnerCommissionForBuyerInvoice(invoice.id);
    expect(second!.id).toBe(first!.id);

    const all = await prisma.partnerCommission.findMany({ where: { buyerInvoiceId: invoice.id } });
    expect(all).toHaveLength(1);
  });

  it("FIRST_PAYMENT_ONLY policy skips every commission after the first", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(buyer.id, admin.id, partner.id, { commissionPolicy: "FIRST_PAYMENT_ONLY" });

    const invoice1 = await makePaidInvoice(agreement.id, admin.id);
    const invoice2 = await makePaidInvoice(agreement.id, admin.id);

    const first = await createPartnerCommissionForBuyerInvoice(invoice1.id);
    const second = await createPartnerCommissionForBuyerInvoice(invoice2.id);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("RECURRING policy earns a commission on every confirmed invoice", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    const agreement = await makeAgreement(buyer.id, admin.id, partner.id, { commissionPolicy: "RECURRING" });

    const invoice1 = await makePaidInvoice(agreement.id, admin.id);
    const invoice2 = await makePaidInvoice(agreement.id, admin.id);

    const first = await createPartnerCommissionForBuyerInvoice(invoice1.id);
    const second = await createPartnerCommissionForBuyerInvoice(invoice2.id);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it("skips creating a commission once commissionEndDate has passed", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    const yesterday = new Date(Date.now() - 86_400_000);
    const agreement = await makeAgreement(buyer.id, admin.id, partner.id, { commissionEndDate: yesterday });
    const invoice = await makePaidInvoice(agreement.id, admin.id);

    const commission = await createPartnerCommissionForBuyerInvoice(invoice.id);
    expect(commission).toBeNull();
  });
});

describe("confirmBuyerInvoicePayment commission wiring", () => {
  it("creates a commission the moment a Buyer invoice is confirmed paid through the payment flow", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const { partner } = await createTestPartner();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, partnerId: partner.id, createdById: admin.id });
    await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });
    const invoice = await createBuyerInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id });

    const { authorizationUrl } = await initializeBuyerInvoicePayment(buyer.id, invoice.id, "buyer@example.com", "http://localhost/buyer/billing/confirm");
    const reference = new URL(authorizationUrl).searchParams.get("reference")!;

    await confirmBuyerInvoicePayment(reference);

    const commission = await prisma.partnerCommission.findUnique({ where: { buyerInvoiceId: invoice.id } });
    expect(commission).not.toBeNull();
    expect(commission!.partnerId).toBe(partner.id);
  });

  it("is a no-op (no commission) when the Buyer's agreement has no Partner attached", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });
    await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });
    const invoice = await createBuyerInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id });

    const { authorizationUrl } = await initializeBuyerInvoicePayment(buyer.id, invoice.id, "buyer@example.com", "http://localhost/buyer/billing/confirm");
    const reference = new URL(authorizationUrl).searchParams.get("reference")!;

    await confirmBuyerInvoicePayment(reference);

    const commission = await prisma.partnerCommission.findUnique({ where: { buyerInvoiceId: invoice.id } });
    expect(commission).toBeNull();
  });
});
