import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getSchoolBilling } from "@/lib/services/billing";
import { listPlans, planPriceForInterval } from "@/lib/services/platform";
import { FEATURE_CATALOG } from "@/lib/billing/features";
import { USAGE_WARNING_THRESHOLD, USAGE_STRONG_WARNING_THRESHOLD, USAGE_URGENT_THRESHOLD } from "@/lib/billing/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PlanPicker, CancelSubscriptionForm, ReactivateSubscriptionForm, PayInvoiceButton } from "./forms";

const SUB_STATUS_VARIANT = {
  TRIALING: "warning",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELED: "neutral",
  EXPIRED: "neutral",
  SUSPENDED: "danger",
} as const;
const INVOICE_STATUS_VARIANT = { PENDING: "warning", PAID: "success", OVERDUE: "danger", VOID: "neutral" } as const;

function usageBarColor(percentUsed: number | null) {
  if (percentUsed == null) return "bg-accent";
  const fraction = percentUsed / 100;
  if (fraction >= 1) return "bg-danger";
  if (fraction >= USAGE_URGENT_THRESHOLD) return "bg-danger";
  if (fraction >= USAGE_STRONG_WARNING_THRESHOLD) return "bg-warning";
  if (fraction >= USAGE_WARNING_THRESHOLD) return "bg-warning";
  return "bg-success";
}

export default async function BillingPage() {
  const user = await requirePermission(PERMISSIONS.BILLING_VIEW);
  const [billing, allPlans, perms] = await Promise.all([
    getSchoolBilling(user.schoolId),
    listPlans(),
    getUserPermissions(user.id),
  ]);
  const canManage = perms.has(PERMISSIONS.BILLING_MANAGE);
  const activePlans = allPlans.filter((p) => p.isActive);

  if (!billing) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
          <p className="text-sm text-muted">Your school&apos;s subscription with Winfield.</p>
        </div>
        <Card>
          <CardContent className="p-8">
            <EmptyState title="No subscription on record" description="Contact Winfield support if you believe this is a mistake." />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription, effectiveStatus, isTrialing, trialDaysRemaining, invoices, usage } = billing;
  const { plan } = subscription;
  const isCancelable = effectiveStatus === "ACTIVE" || effectiveStatus === "PAST_DUE" || isTrialing;
  const isReactivatable = effectiveStatus === "CANCELED" || effectiveStatus === "EXPIRED" || effectiveStatus === "SUSPENDED";
  const includedFeatureCount = Object.values((plan.features as Record<string, boolean>) ?? {}).filter(Boolean).length;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
        <p className="text-sm text-muted">Your school&apos;s subscription with Winfield.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {plan.name} plan <Badge variant={SUB_STATUS_VARIANT[effectiveStatus]}>{effectiveStatus.replace("_", " ")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            {plan.isCustomPricing
              ? "Custom pricing"
              : `${formatMoney(planPriceForInterval(plan, subscription.billingInterval) ?? 0, plan.currency)}/${subscription.billingInterval === "YEARLY" ? "yr" : "mo"}`}
            {" · "}
            {plan.studentLimit ? `up to ${plan.studentLimit} students` : "unlimited students"}
            {" · "}
            {includedFeatureCount} feature{includedFeatureCount === 1 ? "" : "s"} included
          </p>

          {isTrialing ? (
            <p className="text-sm text-warning">
              Your trial ends {subscription.trialEnd ? formatDate(subscription.trialEnd) : "soon"}
              {trialDaysRemaining != null ? ` (${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left)` : ""} — no card required until then.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Current period: {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
            </p>
          )}

          {effectiveStatus === "PAST_DUE" && subscription.graceEndsAt && (
            <p className="text-sm text-danger">
              Your last payment didn&apos;t go through. Access continues until {formatDate(subscription.graceEndsAt)} — please update your payment
              details before then.
            </p>
          )}

          {canManage && (
            <div className="flex items-center gap-3 pt-1">
              {isCancelable && <CancelSubscriptionForm />}
              {isReactivatable && <ReactivateSubscriptionForm defaultInterval={subscription.billingInterval} />}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Student usage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {usage.count} student{usage.count === 1 ? "" : "s"} {usage.limit ? `of ${usage.limit}` : "(unlimited plan)"}
            </span>
            {usage.percentUsed != null && <span className="text-muted">{usage.percentUsed}%</span>}
          </div>
          {usage.limit != null && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted-surface">
              <div
                className={`h-full rounded-full ${usageBarColor(usage.percentUsed)}`}
                style={{ width: `${Math.min(100, usage.percentUsed ?? 0)}%` }}
              />
            </div>
          )}
          {usage.percentUsed != null && usage.percentUsed >= 100 && (
            <p className="text-sm text-danger">
              You&apos;ve reached your plan&apos;s student limit. Upgrade to enroll more students.
            </p>
          )}
          {usage.percentUsed != null && usage.percentUsed >= USAGE_WARNING_THRESHOLD * 100 && usage.percentUsed < 100 && (
            <p className="text-sm text-warning">You&apos;re approaching your plan&apos;s student limit.</p>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Change plan</CardTitle>
            <CardDescription>Switching plans applies immediately. A downgrade is blocked if your active student count exceeds the new plan&apos;s limit.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanPicker plans={activePlans} currentPlanId={plan.id} currentInterval={subscription.billingInterval} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>What&apos;s included</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm text-foreground sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CATALOG.filter((f) => Boolean((plan.features as Record<string, boolean>)?.[f.key])).map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {f.label}
              </li>
            ))}
          </ul>
          {includedFeatureCount === 0 && <p className="text-sm text-muted">No features are configured on this plan yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-muted">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</TableCell>
                    <TableCell>{formatMoney(inv.amountMinor, inv.currency)}</TableCell>
                    <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell><Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canManage && inv.status === "PENDING" && <PayInvoiceButton invoiceId={inv.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!canManage && (
        <p className="text-xs text-muted">
          You can view billing but can&apos;t make changes. Ask a school owner or admin, or see <Link href="/pricing" className="text-accent hover:underline">plans &amp; pricing</Link>.
        </p>
      )}
    </div>
  );
}
