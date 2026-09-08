import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/registry";
import { recalculateInvoiceStatus, invoiceBalanceMinor } from "@/lib/services/invoices";
import { notifyPaymentConfirmed } from "@/lib/services/notifications";

/// Staff directly recording a payment they already have evidence of
/// (cash in hand, a bank alert) — confirmed immediately, no gateway
/// round-trip needed.
export async function recordManualPayment(
  schoolId: string,
  recordedById: string,
  invoiceId: string,
  input: { amountMinor: number; method: "MANUAL" | "BANK_TRANSFER"; reference?: string }
) {
  const invoice = await prisma.invoice.findFirst({ where: { schoolId, id: invoiceId }, include: { payments: true } });
  if (!invoice) throw new Error("Invoice not found");
  if (input.amountMinor <= 0) throw new Error("Enter an amount greater than 0.");

  const payment = await prisma.payment.create({
    data: {
      schoolId,
      invoiceId,
      amountMinor: input.amountMinor,
      method: input.method,
      status: "CONFIRMED",
      reference: input.reference || crypto.randomBytes(12).toString("hex"),
      paidAt: new Date(),
      recordedById,
    },
  });

  const result = await recalculateInvoiceStatus(invoiceId);
  await notifyPaymentConfirmed(schoolId, payment.id);
  return result;
}

/// The payer (no login) has clicked "I've made a bank transfer" on the
/// public pay page — records it as PENDING so staff can confirm it once
/// the money actually lands, rather than trusting the claim outright.
export async function notifyBankTransfer(payToken: string) {
  const invoice = await prisma.invoice.findUnique({ where: { payToken }, include: { payments: true } });
  if (!invoice) throw new Error("Invoice not found");

  const balance = invoiceBalanceMinor(invoice);
  if (balance <= 0) throw new Error("This invoice is already fully paid.");

  return prisma.payment.create({
    data: {
      schoolId: invoice.schoolId,
      invoiceId: invoice.id,
      amountMinor: balance,
      method: "BANK_TRANSFER",
      status: "PENDING",
      reference: crypto.randomBytes(12).toString("hex"),
    },
  });
}

/// The payer has clicked "Pay online" — creates a PENDING payment and asks
/// the configured provider (mock by default) where to send them next.
export async function initiateOnlinePayment(payToken: string, callbackUrl: string) {
  const invoice = await prisma.invoice.findUnique({ where: { payToken }, include: { payments: true, school: true } });
  if (!invoice) throw new Error("Invoice not found");

  const balance = invoiceBalanceMinor(invoice);
  if (balance <= 0) throw new Error("This invoice is already fully paid.");

  const reference = crypto.randomBytes(12).toString("hex");
  await prisma.payment.create({
    data: { schoolId: invoice.schoolId, invoiceId: invoice.id, amountMinor: balance, method: "ONLINE", status: "PENDING", reference },
  });

  const provider = getPaymentProvider();
  const { authorizationUrl } = await provider.initialize({
    amountMinor: balance,
    currency: invoice.school.currency,
    reference,
    callbackUrl,
  });
  return { authorizationUrl, reference };
}

/// Called from the (mock) provider's confirmation page — marks the
/// PENDING online payment CONFIRMED and recalculates the invoice.
export async function confirmOnlinePayment(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.method !== "ONLINE") throw new Error("Payment not found");
  if (payment.status !== "PENDING") return payment;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: "CONFIRMED", paidAt: new Date() } });
  await recalculateInvoiceStatus(payment.invoiceId);
  await notifyPaymentConfirmed(payment.schoolId, payment.id);
  return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

/// Staff confirming a PENDING bank-transfer payment once the money has
/// actually been seen in the account.
export async function confirmPendingPayment(schoolId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({ where: { schoolId, id: paymentId } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "PENDING") throw new Error("This payment isn't pending.");

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "CONFIRMED", paidAt: new Date() } });
  await recalculateInvoiceStatus(payment.invoiceId);
  await notifyPaymentConfirmed(schoolId, paymentId);
  return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
}

export async function rejectPendingPayment(schoolId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({ where: { schoolId, id: paymentId } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "PENDING") throw new Error("This payment isn't pending.");

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
  return recalculateInvoiceStatus(payment.invoiceId);
}
