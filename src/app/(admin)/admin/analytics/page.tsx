import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PopularAppsChart } from "@/components/admin/popular-apps-chart";
import { getRevenueOverTime, getPopularApplications } from "@/lib/services/admin-metrics";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AdminAnalyticsPage() {
  await requirePermission(PERMISSIONS.ANALYTICS_VIEW);

  const [revenueSeries, popularApps, appViews, demoClicks, checkoutStarts, purchases, hostingRevenue, domainRevenue] = await Promise.all([
    getRevenueOverTime(30),
    getPopularApplications(8),
    prisma.analyticsEvent.count({ where: { type: "app_view" } }),
    prisma.analyticsEvent.count({ where: { type: "demo_click" } }),
    prisma.analyticsEvent.count({ where: { type: "checkout_start" } }),
    prisma.analyticsEvent.count({ where: { type: "purchase" } }),
    prisma.orderItem.aggregate({ _sum: { total: true }, where: { type: "HOSTING_PLAN" } }),
    prisma.orderItem.aggregate({ _sum: { total: true }, where: { type: "DOMAIN" } }),
  ]);

  const conversionRate = checkoutStarts > 0 ? ((purchases / checkoutStarts) * 100).toFixed(1) : "0.0";

  const funnel = [
    { label: "Application Views", value: appViews },
    { label: "Demo Clicks", value: demoClicks },
    { label: "Checkout Started", value: checkoutStarts },
    { label: "Purchases", value: purchases },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {funnel.map((item) => (
          <Card key={item.label}>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{item.value}</p>
              <p className="text-xs text-muted">{item.label}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{conversionRate}%</p>
            <p className="text-xs text-muted">Conversion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(Number(hostingRevenue._sum.total ?? 0))}</p>
            <p className="text-xs text-muted">Hosting Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(Number(domainRevenue._sum.total ?? 0))}</p>
            <p className="text-xs text-muted">Domain Revenue</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Product</CardTitle>
          </CardHeader>
          <CardContent>
            {popularApps.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted">No sales data yet.</p>
            ) : (
              <PopularAppsChart data={popularApps} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
