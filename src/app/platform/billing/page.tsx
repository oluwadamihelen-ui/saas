import Link from "next/link";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSuperAdmin } from "@/lib/auth/require";
import {
  getPlatformStats,
  getRevenueByInterval,
  getChurnMetrics,
  getExpiringTrialSchools,
  getOverduePlatformInvoices,
} from "@/lib/services/platform";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT = {
  TRIALING: "warning",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELED: "neutral",
  EXPIRED: "neutral",
  SUSPENDED: "danger",
} as const;

export default async function PlatformBillingPage() {
  await requireSuperAdmin();
  const [stats, revenue, churn, expiringTrials, overdueInvoices] = await Promise.all([
    getPlatformStats(),
    getRevenueByInterval(),
    getChurnMetrics(),
    getExpiringTrialSchools(),
    getOverduePlatformInvoices(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Billing</h1>
        <p className="text-sm text-muted">Revenue and subscription health across every school on Schoolum.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={formatMoney(stats.mrrMinor, "NGN")} hint={`${stats.activeSubscriptionCount} paying subscriptions`} />
        <StatCard label="ARR" value={formatMoney(stats.arrMinor, "NGN")} />
        <StatCard label="In trial" value={stats.trialingSubscriptions} hint={`${expiringTrials.length} ending within 7 days`} />
        <StatCard label="Churn (30d)" value={`${churn.churnRatePercent}%`} hint={`${churn.canceledLast30Days} cancelled`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions by status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {(Object.keys(stats.subscriptionStatusCounts) as (keyof typeof stats.subscriptionStatusCounts)[]).map((status) => (
            <Badge key={status} variant={STATUS_VARIANT[status]}>
              {stats.subscriptionStatusCounts[status]} {status.replace("_", " ").toLowerCase()}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by billing interval</CardTitle>
            <CardDescription>Un-normalized — an annual subscriber&apos;s actual yearly price, not divided by 12.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center justify-between"><span className="text-muted">Monthly subscribers</span> <span className="font-medium text-foreground">{formatMoney(revenue.monthlyMinor, "NGN")}</span></p>
            <p className="flex items-center justify-between"><span className="text-muted">Annual subscribers</span> <span className="font-medium text-foreground">{formatMoney(revenue.yearlyMinor, "NGN")}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Plan mix</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.planMix.length === 0 ? (
              <p className="text-muted">No active or past-due subscriptions yet.</p>
            ) : (
              stats.planMix.map((p) => (
                <p key={p.planName} className="flex items-center justify-between">
                  <span className="text-muted">{p.planName}</span> <span className="font-medium text-foreground">{p.count}</span>
                </p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trials ending soon</CardTitle>
          <CardDescription>Within the next 7 days.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {expiringTrials.length === 0 ? (
            <EmptyState title="No trials ending soon" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Trial ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringTrials.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Link href={`/platform/schools/${sub.schoolId}`} className="font-medium text-foreground hover:text-accent">
                        {sub.school.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted">{sub.plan.name}</TableCell>
                    <TableCell className="text-muted">{sub.trialEnd ? formatDate(sub.trialEnd) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overdue invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overdueInvoices.length === 0 ? (
            <EmptyState title="No overdue invoices" className="p-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/platform/schools/${inv.schoolId}`} className="font-medium text-foreground hover:text-accent">
                        {inv.school.name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatMoney(inv.amountMinor, inv.currency)}</TableCell>
                    <TableCell className="text-muted">{formatDate(inv.dueDate)}</TableCell>
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
