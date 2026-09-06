import type { Metadata } from "next";
import { DollarSign, ShoppingBag, Users, Package, Rocket, Globe, Server, AlertTriangle, LifeBuoy, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth/require";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getAdminOverviewMetrics, getPopularApplications, getRevenueOverTime } from "@/lib/services/admin-metrics";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { PopularAppsChart } from "@/components/admin/popular-apps-chart";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  await requireRole("SUPER_ADMIN", "STAFF");

  const [metrics, revenueSeries, popularApps] = await Promise.all([
    getAdminOverviewMetrics(),
    getRevenueOverTime(30),
    getPopularApplications(),
  ]);

  const cards = [
    { label: "Revenue", value: formatCurrency(metrics.revenue), icon: DollarSign },
    { label: "Orders", value: metrics.orderCount, icon: ShoppingBag },
    { label: "Customers", value: metrics.customerCount, icon: Users },
    { label: "Applications Sold", value: metrics.licensesSold, icon: Package },
    { label: "Active Deployments", value: metrics.activeDeployments, icon: Rocket },
    { label: "Active Domains", value: metrics.activeDomains, icon: Globe },
    { label: "Active Hosting", value: metrics.activeHosting, icon: Server },
    { label: "MRR", value: formatCurrency(metrics.mrr), icon: TrendingUp },
    { label: "ARR", value: formatCurrency(metrics.arr), icon: TrendingUp },
    { label: "Pending Deployments", value: metrics.pendingDeployments, icon: AlertTriangle },
    { label: "Failed Deployments", value: metrics.failedDeployments, icon: AlertTriangle },
    { label: "Open Tickets", value: metrics.openTickets, icon: LifeBuoy },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft">
                <card.icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{card.value}</p>
                <p className="text-xs text-muted">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Popular Applications</CardTitle>
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
