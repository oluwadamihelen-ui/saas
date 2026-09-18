import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { confirmSubscriptionPayment } from "@/lib/billing/payment-provider";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";

/// Where every gateway lands the school after checkout for a platform
/// (Schoolum subscription) invoice — mirrors /pay/[token]/confirm's real-
/// vs-mock split exactly, just scoped to the signed-in school's own
/// invoice instead of a public pay-link token.
export default async function BillingConfirmPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const user = await requirePermission(PERMISSIONS.BILLING_VIEW);
  const { reference } = await searchParams;
  if (!reference) notFound();

  let invoice = await prisma.platformInvoice.findUnique({ where: { providerReference: reference } });
  if (!invoice || invoice.schoolId !== user.schoolId) notFound();

  const isRealGateway = Boolean(invoice.provider);
  if (isRealGateway && invoice.status === "PENDING") {
    invoice = await confirmSubscriptionPayment(reference);
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
          <p className="text-sm text-muted">
            For your {invoice.billingInterval === "YEARLY" ? "annual" : "monthly"} Schoolum subscription
          </p>
          {invoice.status === "PAID" && <p className="text-sm font-medium text-success">Payment confirmed. Thank you!</p>}
          {invoice.status === "VOID" && <p className="text-sm font-medium text-danger">This invoice is no longer valid.</p>}
          {invoice.status === "PENDING" && isRealGateway && (
            <p className="text-sm font-medium text-warning">Still processing — refresh this page in a moment.</p>
          )}
          {invoice.status === "PENDING" && !isRealGateway && <ConfirmButton reference={reference} />}
          {invoice.status !== "PENDING" && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/billing">Back to billing</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
