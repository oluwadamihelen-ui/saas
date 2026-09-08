import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInvoiceByToken } from "@/lib/services/invoices";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";

/// Stands in for a real gateway's hosted checkout page — the mock provider
/// (src/lib/payments/mock-provider.ts) redirects here instead of to Paystack
/// or Flutterwave. A real adapter would skip this screen entirely and land
/// the payer back on a webhook-driven callback.
export default async function ConfirmMockPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { token } = await params;
  const { reference } = await searchParams;
  if (!reference) notFound();

  const [invoice, payment] = await Promise.all([
    getInvoiceByToken(token),
    prisma.payment.findUnique({ where: { reference } }),
  ]);
  if (!invoice || !payment) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm your payment</CardTitle>
        <CardDescription>This is a simulated checkout — no real payment gateway is configured.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-semibold text-foreground">{formatMoney(payment.amountMinor, invoice.school.currency)}</p>
        <p className="text-sm text-muted">To {invoice.school.name}, invoice {invoice.invoiceNumber}</p>
        {payment.status === "CONFIRMED" ? (
          <p className="text-sm font-medium text-success">Already confirmed.</p>
        ) : (
          <ConfirmButton reference={reference} token={token} />
        )}
      </CardContent>
    </Card>
  );
}
