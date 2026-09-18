import "server-only";
import { prisma } from "@/lib/db";
import { confirmOnlinePayment } from "@/lib/services/payments";
import { confirmApplicationFeeOnlinePayment } from "@/lib/services/admission";
import type { PaymentGatewayProvider } from "@/generated/prisma/client";

/// A webhook arrives with only a reference — this finds which school's
/// (school, provider) credential row to verify its signature against,
/// covering both an invoice's Payment.reference and an admission
/// applicant's feePaymentReference.
export async function findCredentialForReference(provider: PaymentGatewayProvider, reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { schoolId: true } });
  const schoolId =
    payment?.schoolId ??
    (await prisma.applicant.findUnique({ where: { feePaymentReference: reference }, select: { schoolId: true } }))?.schoolId;
  if (!schoolId) return null;

  return prisma.paymentGatewayCredential.findUnique({ where: { schoolId_provider: { schoolId, provider } } });
}

/// Confirms whichever record this reference belongs to — an invoice
/// payment or an admission application fee. Both target functions are
/// idempotent (a no-op once already confirmed), so this is safe to call
/// from a webhook that may retry or arrive after the confirm page already
/// handled the same reference.
export async function confirmReferenceEverywhere(reference: string) {
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
  if (payment) {
    await confirmOnlinePayment(reference);
    return;
  }
  const applicant = await prisma.applicant.findUnique({ where: { feePaymentReference: reference }, select: { id: true } });
  if (applicant) {
    await confirmApplicationFeeOnlinePayment(reference);
  }
}
