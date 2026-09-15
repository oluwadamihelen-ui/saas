import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getSchoolBySlug, confirmApplicationFeeOnlinePayment } from "@/lib/services/admission";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";

/// Mirrors /pay/[token]/confirm — a real gateway has already charged (or
/// declined) the card by the time the payer lands here, so this verifies
/// server-side and shows the outcome immediately; the mock/simulated
/// gateway (no school-connected provider) falls back to a manual
/// "click to confirm" button instead.
export default async function ApplicationFeeConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; applicantId: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { slug, applicantId } = await params;
  const { reference } = await searchParams;
  if (!reference) notFound();

  const school = await getSchoolBySlug(slug);
  let applicant = await prisma.applicant.findUnique({ where: { feePaymentReference: reference } });
  if (!school || !applicant || applicant.schoolId !== school.id || applicant.id !== applicantId) notFound();

  const isRealGateway = Boolean(applicant.feePaymentProvider);
  if (isRealGateway && applicant.feeStatus === "UNPAID") {
    applicant = await confirmApplicationFeeOnlinePayment(reference);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRealGateway ? "Payment" : "Confirm your payment"}</CardTitle>
        <CardDescription>
          {isRealGateway
            ? `Paid via ${applicant.feePaymentProvider}`
            : "This is a simulated checkout — the school hasn't connected a payment gateway yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-semibold text-foreground">{formatMoney(applicant.admissionFeeMinor ?? 0, school.currency)}</p>
        <p className="text-sm text-muted">To {school.name}, application fee</p>
        {applicant.feeStatus === "PAID" && <p className="text-sm font-medium text-success">Payment confirmed. Thank you!</p>}
        {applicant.feeStatus === "UNPAID" && isRealGateway && (
          <p className="text-sm font-medium text-warning">Still processing — refresh this page in a moment.</p>
        )}
        {applicant.feeStatus === "UNPAID" && !isRealGateway && (
          <ConfirmButton reference={reference} slug={slug} applicantId={applicantId} />
        )}
      </CardContent>
    </Card>
  );
}
