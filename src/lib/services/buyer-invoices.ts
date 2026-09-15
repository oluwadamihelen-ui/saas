import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/// A Buyer invoice may only ever be created against an ACTIVE agreement —
/// same canCreateInvoice rule as the Partner Program's own BUY installment
/// invoices, just without needing a shared helper since this is the only
/// invoice-creation path a Buyer has.
export async function createBuyerInvoice(input: {
  agreementId: string;
  description?: string | null;
  amountMinor: number;
  dueDate: Date;
  createdById: string;
}) {
  const agreement = await prisma.buyerAgreement.findUnique({ where: { id: input.agreementId } });
  if (!agreement) throw new Error("Buyer agreement not found.");
  if (agreement.status !== "ACTIVE") throw new Error("This agreement is not ACTIVE — it cannot create invoices.");

  const invoice = await prisma.buyerInvoice.create({
    data: {
      buyerId: agreement.buyerId,
      buyerAgreementId: agreement.id,
      description: input.description?.trim() || null,
      amountMinor: input.amountMinor,
      currency: agreement.currency,
      dueDate: input.dueDate,
      createdById: input.createdById,
    },
  });

  await logAudit({
    schoolId: null,
    userId: input.createdById,
    action: "buyer_invoice.created",
    resourceType: "BuyerInvoice",
    resourceId: invoice.id,
    newValue: { buyerAgreementId: agreement.id, amountMinor: input.amountMinor },
  });

  return invoice;
}

/// Manual "mark as paid" for an offline payment (bank transfer, etc.) —
/// mirrors markPlatformInvoicePaid exactly.
export async function markBuyerInvoicePaid(invoiceId: string, markedPaidById: string) {
  const invoice = await prisma.buyerInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("This invoice is already paid.");

  const updated = await prisma.buyerInvoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date(), markedPaidById },
  });

  await logAudit({ schoolId: null, userId: markedPaidById, action: "buyer_invoice.marked_paid", resourceType: "BuyerInvoice", resourceId: invoiceId });
  return updated;
}

export async function voidBuyerInvoice(invoiceId: string, voidedById: string) {
  const invoice = await prisma.buyerInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("A paid invoice can't be voided.");

  const updated = await prisma.buyerInvoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
  await logAudit({ schoolId: null, userId: voidedById, action: "buyer_invoice.voided", resourceType: "BuyerInvoice", resourceId: invoiceId });
  return updated;
}
