import Link from "next/link";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth/require";
import { getPlatformStats } from "@/lib/services/platform";
import { formatMoney } from "@/lib/money";

export default async function PlatformOverviewPage() {
  await requireSuperAdmin();
  const stats = await getPlatformStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Platform overview</h1>
        <p className="text-sm text-muted">Every school on Schoolum, at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Schools" value={stats.totalSchools} hint={`${stats.statusCounts.ACTIVE} active`} />
        <StatCard label="Students (platform-wide)" value={stats.totalStudents} />
        <StatCard label="MRR" value={formatMoney(stats.mrrMinor, "NGN")} hint={`${stats.activeSubscriptionCount} paying subscriptions`} />
        <StatCard label="In trial" value={stats.trialingSubscriptions} hint={stats.overdueInvoices > 0 ? `${stats.overdueInvoices} overdue invoice${stats.overdueInvoices === 1 ? "" : "s"}` : "No overdue invoices"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schools by status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="warning">{stats.statusCounts.TRIAL} trial</Badge>
          <Badge variant="success">{stats.statusCounts.ACTIVE} active</Badge>
          <Badge variant="danger">{stats.statusCounts.SUSPENDED} suspended</Badge>
          <Button asChild size="sm" variant="secondary" className="ml-auto">
            <Link href="/platform/schools">View all schools</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
