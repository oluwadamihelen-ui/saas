import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTestBuyer, cleanupTestBuyers } from "../helpers/buyer-factories";
import { createBuyerAgreement, approveAndActivateBuyerAgreement } from "@/lib/services/buyer-agreements";
import { createBuyerInvoice, markBuyerInvoicePaid, voidBuyerInvoice } from "@/lib/services/buyer-invoices";
import { initializeBuyerInvoicePayment, confirmBuyerInvoicePayment } from "@/lib/billing/payment-provider";

afterAll(async () => {
  await cleanupTestBuyers();
});

async function makeActiveAgreement() {
  const { buyer, user: admin } = await createTestBuyer();
  const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });
  await approveAndActivateBuyerAgreement({ agreementId: agreement.id, approvedById: admin.id });
  return { buyer, admin, agreement };
}

describe("createBuyerInvoice", () => {
  it("refuses to create an invoice for a non-ACTIVE agreement", async () => {
    const { buyer, user: admin } = await createTestBuyer();
    const agreement = await createBuyerAgreement({ buyerId: buyer.id, createdById: admin.id });

    await expect(
      createBuyerInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id })
    ).rejects.toThrow();
  });

  it("creates the invoice linked to the agreement and buyer once ACTIVE", async () => {
    const { buyer, admin, agreement } = await makeActiveAgreement();
    const invoice = await createBuyerInvoice({
      agreementId: agreement.id,
      description: "Installment 1 of 3",
      amountMinor: 100_000_00,
      dueDate: new Date(),
      createdById: admin.id,
    });
    expect(invoice.buyerId).toBe(buyer.id);
    expect(invoice.buyerAgreementId).toBe(agreement.id);
    expect(invoice.status).toBe("PENDING");
  });
});

describe("markBuyerInvoicePaid / voidBuyerInvoice", () => {
  it("marks an invoice paid, and refuses to pay or void it again", async () => {
    const { admin, agreement } = await makeActiveAgreement();
    const invoice = await createBuyerInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id });

    const paid = await markBuyerInvoicePaid(invoice.id, admin.id);
    expect(paid.status).toBe("PAID");
    await expect(markBuyerInvoicePaid(invoice.id, admin.id)).rejects.toThrow();
    await expect(voidBuyerInvoice(invoice.id, admin.id)).rejects.toThrow();
  });

  it("voids an unpaid invoice", async () => {
    const { admin, agreement } = await makeActiveAgreement();
    const invoice = await createBuyerInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id });

    const voided = await voidBuyerInvoice(invoice.id, admin.id);
    expect(voided.status).toBe("VOID");
  });
});

describe("Buyer invoice payment flow (simulated gateway)", () => {
  it("initializes then confirms a payment, and confirming twice is idempotent", async () => {
    const { buyer, admin, agreement } = await makeActiveAgreement();
    const invoice = await createBuyerInvoice({ agreementId: agreement.id, amountMinor: 250_000_00, dueDate: new Date(), createdById: admin.id });

    const { authorizationUrl } = await initializeBuyerInvoicePayment(buyer.id, invoice.id, "buyer@example.com", "http://localhost/buyer/billing/confirm");
    const reference = new URL(authorizationUrl).searchParams.get("reference");
    expect(reference).toBeTruthy();

    const stillPending = await prisma.buyerInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stillPending.status).toBe("PENDING");
    expect(stillPending.providerReference).toBe(reference);
    expect(stillPending.provider).toBeNull();

    // No Paystack credentials configured in this test environment, so
    // invoice.provider is null and confirmBuyerInvoicePayment skips
    // verification entirely — same "the confirm page/button IS the trust
    // boundary in mock mode" shape as confirmSubscriptionPayment.
    const confirmed = await confirmBuyerInvoicePayment(reference!);
    expect(confirmed.status).toBe("PAID");

    // Idempotent: confirming an already-PAID invoice is a safe no-op.
    const confirmedAgain = await confirmBuyerInvoicePayment(reference!);
    expect(confirmedAgain.id).toBe(confirmed.id);
    expect(confirmedAgain.status).toBe("PAID");
  });

  it("refuses to initialize payment for an already-PAID invoice", async () => {
    const { buyer, admin, agreement } = await makeActiveAgreement();
    const invoice = await createBuyerInvoice({ agreementId: agreement.id, amountMinor: 100_000_00, dueDate: new Date(), createdById: admin.id });
    await markBuyerInvoicePaid(invoice.id, admin.id);

    await expect(
      initializeBuyerInvoicePayment(buyer.id, invoice.id, "buyer@example.com", "http://localhost/buyer/billing/confirm")
    ).rejects.toThrow();
  });
});
