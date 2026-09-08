import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getSchoolBilling } from "@/lib/services/billing";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

const SUB_STATUS_VARIANT = { TRIALING: "warning", ACTIVE: "success", PAST_DUE: "danger", CANCELED: "neutral" } as const;
const INVOICE_STATUS_VARIANT = { PENDING: "warning", PAID: "success", OVERDUE: "danger", VOID: "neutral" } as const;

export default async function BillingPage() {
  const user = await requirePermission(PERMISSIONS.BILLING_VIEW);
  const subscription = await getSchoolBilling(user.schoolId);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
        <p className="text-sm text-muted">Your school&apos;s subscription with Winfield.</p>
      </div>

      {!subscription ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState title="No subscription on record" description="Contact Winfield support if you believe this is a mistake." />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {subscription.plan.name} plan <Badge variant={SUB_STATUS_VARIANT[subscription.status]}>{subscription.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">
                {formatMoney(subscription.plan.priceMinor, "NGN")}/{subscription.plan.billingInterval === "MONTHLY" ? "mo" : "yr"} ·{" "}
                {subscription.plan.studentLimit ? `up to ${subscription.plan.studentLimit} students` : "unlimited students"}
              </p>
              <p className="mt-1 text-sm text-muted">
                Current period: {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent className="p-0">
              {subscription.invoices.length === 0 ? (
                <EmptyState title="No invoices yet" className="p-8" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscription.invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-muted">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</TableCell>
                        <TableCell>{formatMoney(inv.amountMinor, "NGN")}</TableCell>
                        <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
                        <TableCell><Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
