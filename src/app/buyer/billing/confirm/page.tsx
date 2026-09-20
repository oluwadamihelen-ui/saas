import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireBuyer } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { confirmBuyerInvoicePayment } from "@/lib/billing/payment-provider";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";

/// Where every gateway lands the Buyer after checkout for a BuyerInvoice —
/// mirrors /dashboard/billing/confirm exactly, just scoped to the signed-in
/// Buyer's own invoice instead of a school's.
export default async function BuyerBillingConfirmPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const sessionUser = await requireBuyer();
  const buyer = await prisma.buyer.findUniqueOrThrow({ where: { userId: sessionUser.id } });
  const { reference } = await searchParams;
  if (!reference) notFound();

  let invoice = await prisma.buyerInvoice.findUnique({ where: { providerReference: reference } });
  if (!invoice || invoice.buyerId !== buyer.id) notFound();

  const isRealGateway = Boolean(invoice.provider);
  if (isRealGateway && invoice.status === "PENDING") {
    invoice = await confirmBuyerInvoicePayment(reference);
  }

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{isRealGateway ? "Payment" : "Confirm your payment"}</CardTitle>
          <CardDescription>
            {isRealGateway ? `Paid via ${invoice.provider}` : "This is a simulated checkout — Schoolum hasn't connected a live payment gateway yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-2xl font-semibold text-foreground">{formatMoney(invoice.amountMinor, invoice.currency)}</p>
          {invoice.description && <p className="text-sm text-muted">{invoice.description}</p>}
          {invoice.status === "PAID" && <p className="text-sm font-medium text-success">Payment confirmed. Thank you!</p>}
          {invoice.status === "VOID" && <p className="text-sm font-medium text-danger">This invoice is no longer valid.</p>}
          {invoice.status === "PENDING" && isRealGateway && (
            <p className="text-sm font-medium text-warning">Still processing — refresh this page in a moment.</p>
          )}
          {invoice.status === "PENDING" && !isRealGateway && <ConfirmButton reference={reference} />}
          {invoice.status !== "PENDING" && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/buyer">Back to dashboard</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
