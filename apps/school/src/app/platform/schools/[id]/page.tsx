import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import { getSchoolForPlatform, listPlans, planPriceForInterval } from "@/lib/services/platform";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { SchoolStatusForm, CreateSubscriptionForm, PlanChangeForm, SubscriptionStatusForm, GenerateInvoiceButton, InvoiceActions } from "../forms";

const SCHOOL_STATUS_VARIANT = { TRIAL: "warning", ACTIVE: "success", SUSPENDED: "danger" } as const;
const SUB_STATUS_VARIANT = {
  TRIALING: "warning",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELED: "neutral",
  EXPIRED: "neutral",
  SUSPENDED: "danger",
} as const;
const INVOICE_STATUS_VARIANT = { PENDING: "warning", PAID: "success", OVERDUE: "danger", VOID: "neutral" } as const;

export default async function PlatformSchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;

  const [school, plans] = await Promise.all([getSchoolForPlatform(id), listPlans()]);
  if (!school) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm"><Link href="/platform/schools">&larr; Schools</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{school.name}</h1>
        <p className="text-sm text-muted">
          {school._count.students} students · {school._count.users} staff · created {formatDate(school.createdAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Account status <Badge variant={SCHOOL_STATUS_VARIANT[school.status]}>{school.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SchoolStatusForm schoolId={school.id} currentStatus={school.status} />
        </CardContent>
      </Card>

      {school.subscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Subscription <Badge variant={SUB_STATUS_VARIANT[school.subscription.status]}>{school.subscription.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              {school.subscription.plan.name}
              {school.subscription.plan.isCustomPricing ? (
                " — custom pricing"
              ) : (
                <>
                  {" — "}
                  {formatMoney(
                    planPriceForInterval(school.subscription.plan, school.subscription.billingInterval) ?? 0,
                    school.subscription.plan.currency
                  )}
                  /{school.subscription.billingInterval === "YEARLY" ? "yr" : "mo"}
                </>
              )}
              {" · current period "}
              {formatDate(school.subscription.currentPeriodStart)} – {formatDate(school.subscription.currentPeriodEnd)}
            </p>
            <PlanChangeForm schoolId={school.id} currentPlanId={school.subscription.planId} plans={plans} />
            <SubscriptionStatusForm schoolId={school.id} currentStatus={school.subscription.status} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <EmptyState title="No subscription" description="This school has no subscription on record." />
            <CreateSubscriptionForm schoolId={school.id} plans={plans} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Platform invoices</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {school.subscription && <GenerateInvoiceButton schoolId={school.id} />}
          {school.platformInvoices.length === 0 ? (
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
                {school.platformInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-muted">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</TableCell>
                    <TableCell>{formatMoney(inv.amountMinor, "NGN")}</TableCell>
                    <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell><Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right"><InvoiceActions invoiceId={inv.id} schoolId={school.id} status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
