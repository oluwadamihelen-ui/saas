import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInvoiceByToken } from "@/lib/services/invoices";
import { confirmOnlinePayment } from "@/lib/services/payments";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";

/// Where every gateway lands the payer after checkout. A connected real
/// gateway (Paystack/Flutterwave/Korapay) has already charged — or
/// declined — the card by the time the payer gets here, so this verifies
/// server-side against that gateway's own API and shows the outcome
/// immediately, no action needed. The mock/simulated gateway (no school
/// has connected a real one) has nothing to verify against, so it falls
/// back to the original "click to simulate paying" button instead.
export default async function ConfirmPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { token } = await params;
  const { reference } = await searchParams;
  if (!reference) notFound();

  const invoice = await getInvoiceByToken(token);
  let payment = await prisma.payment.findUnique({ where: { reference } });
  if (!invoice || !payment) notFound();

  const isRealGateway = Boolean(payment.provider);
  if (isRealGateway && payment.status === "PENDING") {
    payment = await confirmOnlinePayment(reference);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isRealGateway ? "Payment" : "Confirm your payment"}</CardTitle>
        <CardDescription>
          {isRealGateway ? `Paid via ${payment.provider}` : "This is a simulated checkout — the school hasn't connected a payment gateway yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-semibold text-foreground">{formatMoney(payment.amountMinor, invoice.school.currency)}</p>
        <p className="text-sm text-muted">To {invoice.school.name}, invoice {invoice.invoiceNumber}</p>
        {payment.status === "CONFIRMED" && <p className="text-sm font-medium text-success">Payment confirmed. Thank you!</p>}
        {payment.status === "FAILED" && <p className="text-sm font-medium text-danger">This payment could not be confirmed. Please try again.</p>}
        {payment.status === "PENDING" && isRealGateway && (
          <p className="text-sm font-medium text-warning">Still processing — refresh this page in a moment.</p>
        )}
        {payment.status === "PENDING" && !isRealGateway && <ConfirmButton reference={reference} token={token} />}
      </CardContent>
    </Card>
  );
}
