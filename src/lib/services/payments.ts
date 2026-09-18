import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { resolvePaymentProvider, resolveCredentialedProvider } from "@/lib/payments/registry";
import { recalculateInvoiceStatus, invoiceBalanceMinor } from "@/lib/services/invoices";
import { notifyPaymentConfirmed } from "@/lib/services/notifications";

/// Real gateways need an email address for their hosted checkout — prefers
/// the student's primary guardian, then any guardian on file, then falls
/// back to the school's own contact address rather than failing outright
/// (the mock gateway never looks at this, so it's only exercised once a
/// school connects a real one).
async function resolveInvoicePayerEmail(studentId: string, schoolEmail: string | null): Promise<string> {
  const link = await prisma.studentGuardian.findFirst({
    where: { studentId, guardian: { email: { not: null } } },
    orderBy: { isPrimary: "desc" },
    include: { guardian: true },
  });
  return link?.guardian.email || schoolEmail || "payer@no-email.invalid";
}

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
/// whichever gateway this school has connected and activated (or, absent
/// that, the built-in mock/simulated gateway) where to send them next.
/// Which provider answered is recorded on the payment itself, so
/// confirmation later re-resolves the *same* gateway even if the school
/// switches its active one in the meantime.
export async function initiateOnlinePayment(payToken: string, callbackUrl: string) {
  const invoice = await prisma.invoice.findUnique({ where: { payToken }, include: { payments: true, school: true } });
  if (!invoice) throw new Error("Invoice not found");

  const balance = invoiceBalanceMinor(invoice);
  if (balance <= 0) throw new Error("This invoice is already fully paid.");

  const { provider, providerName, credentials } = await resolvePaymentProvider(invoice.schoolId);
  const payerEmail = await resolveInvoicePayerEmail(invoice.studentId, invoice.school.email);

  const reference = crypto.randomBytes(12).toString("hex");
  await prisma.payment.create({
    data: {
      schoolId: invoice.schoolId,
      invoiceId: invoice.id,
      amountMinor: balance,
      method: "ONLINE",
      status: "PENDING",
      reference,
      provider: providerName,
    },
  });

  const { authorizationUrl } = await provider.initialize(
    { amountMinor: balance, currency: invoice.school.currency, reference, callbackUrl, payerEmail },
    credentials
  );
  return { authorizationUrl, reference };
}

/// Called from the pay confirmation page once the payer lands back from
/// checkout. For the mock gateway (provider: null) this trusts the click,
/// same simulated round trip as before; for a real gateway it verifies
/// server-side against that gateway's own API first — never trusting the
/// redirect alone — before marking the payment CONFIRMED.
export async function confirmOnlinePayment(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.method !== "ONLINE") throw new Error("Payment not found");
  if (payment.status !== "PENDING") return payment;

  if (payment.provider) {
    const resolved = await resolveCredentialedProvider(payment.schoolId, payment.provider);
    if (!resolved) throw new Error("This school's payment gateway is no longer connected — contact the school to confirm your payment.");

    const result = await resolved.provider.verify(reference, resolved.credentials);
    if (result.status === "failed") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    }
    if (result.status === "pending") return payment;
  }

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
