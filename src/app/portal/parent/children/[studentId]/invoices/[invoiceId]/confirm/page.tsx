import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireSchoolUser } from "@/lib/auth/require";
import { getChildForGuardian } from "@/lib/services/portal";
import { getInvoice } from "@/lib/services/invoices";
import { confirmOnlinePayment } from "@/lib/services/payments";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";

/// The in-portal counterpart to /pay/[token]/confirm — same verify-then-
/// confirm logic, but never leaves the parent portal's own layout.
export default async function PortalPaymentConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string; invoiceId: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { studentId, invoiceId } = await params;
  const { reference } = await searchParams;
  if (!reference) notFound();

  const user = await requireSchoolUser();
  const [student, invoice] = await Promise.all([
    getChildForGuardian(user.schoolId, user.id, studentId),
    getInvoice(user.schoolId, invoiceId),
  ]);
  if (!student || !invoice || invoice.studentId !== studentId) notFound();

  let payment = invoice.payments.find((p) => p.reference === reference);
  if (!payment) notFound();

  const school = await prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } });
  const isRealGateway = Boolean(payment.provider);
  if (isRealGateway && payment.status === "PENDING") {
    payment = await confirmOnlinePayment(reference);
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{isRealGateway ? "Payment" : "Confirm your payment"}</CardTitle>
          <CardDescription>
            {isRealGateway ? `Paid via ${payment.provider}` : "This is a simulated checkout — the school hasn't connected a payment gateway yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold text-foreground">{formatMoney(payment.amountMinor, school.currency)}</p>
          <p className="text-sm text-muted">To {school.name}, invoice {invoice.invoiceNumber}</p>
          {payment.status === "CONFIRMED" && <p className="text-sm font-medium text-success">Payment confirmed. Thank you!</p>}
          {payment.status === "FAILED" && <p className="text-sm font-medium text-danger">This payment could not be confirmed. Please try again.</p>}
          {payment.status === "PENDING" && isRealGateway && (
            <p className="text-sm font-medium text-warning">Still processing — refresh this page in a moment.</p>
          )}
          {payment.status === "PENDING" && !isRealGateway && (
            <ConfirmButton reference={reference} studentId={studentId} invoiceId={invoiceId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
