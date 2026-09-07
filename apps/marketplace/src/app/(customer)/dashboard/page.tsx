import Link from "next/link";
import type { Metadata } from "next";
import { Rocket, Globe, Server, LifeBuoy, FileText, ShoppingBag, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardOverviewPage() {
  const user = await requireUser();
  // eslint-disable-next-line react-hooks/purity -- server component: request-time value, not render output
  const expiryThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [applicationCount, deploymentCount, domainCount, hostingCount, openTickets, unpaidInvoices, recentOrders, recentDeployments, expiringDomains] =
    await Promise.all([
      prisma.applicationLicense.count({ where: { customerId: user.id, status: "ACTIVE" } }),
      prisma.deployment.count({ where: { customerId: user.id } }),
      prisma.domain.count({ where: { customerId: user.id } }),
      prisma.hostingAccount.count({ where: { customerId: user.id } }),
      prisma.supportTicket.count({ where: { customerId: user.id, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER"] } } }),
      prisma.invoice.count({ where: { customerId: user.id, status: { in: ["SENT", "OVERDUE"] } } }),
      prisma.order.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.deployment.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { application: true } }),
      prisma.domain.findMany({
        where: { customerId: user.id, expiresAt: { lte: expiryThreshold } },
        orderBy: { expiresAt: "asc" },
        take: 5,
      }),
    ]);

  const cards = [
    { label: "Active Applications", value: applicationCount, icon: ShoppingBag, href: "/dashboard/orders" },
    { label: "Active Deployments", value: deploymentCount, icon: Rocket, href: "/dashboard/deployments" },
    { label: "Domains", value: domainCount, icon: Globe, href: "/dashboard/domains" },
    { label: "Hosting Services", value: hostingCount, icon: Server, href: "/dashboard/hosting" },
    { label: "Open Tickets", value: openTickets, icon: LifeBuoy, href: "/dashboard/support" },
    { label: "Outstanding Invoices", value: unpaidInvoices, icon: FileText, href: "/dashboard/invoices" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name?.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening across your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/apps">
              <Plus className="h-4 w-4" /> Buy Application
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/domains">Register Domain</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/dashboard/support">Open Ticket</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-3">
                <card.icon className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-2xl font-semibold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {expiringDomains.length > 0 && (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Domain Expiry Alerts</p>
            {expiringDomains.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">{d.name}</span>
                <span className="font-medium text-warning">Renews {d.expiresAt ? formatDate(d.expiresAt) : "soon"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Recent Orders</p>
              <Link href="/dashboard/orders" className="text-xs font-medium text-accent">
                View all
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <EmptyState title="No orders yet" description="Purchase an application to get started." />
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted-surface"
                  >
                    <div>
                      <p className="font-medium text-foreground">{order.orderNumber}</p>
                      <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(Number(order.total), order.currency)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Recent Deployments</p>
              <Link href="/dashboard/deployments" className="text-xs font-medium text-accent">
                View all
              </Link>
            </div>
            {recentDeployments.length === 0 ? (
              <EmptyState title="No deployments yet" description="Deployments will appear here after checkout." />
            ) : (
              <div className="space-y-3">
                {recentDeployments.map((d) => (
                  <Link
                    key={d.id}
                    href={`/dashboard/deployments/${d.id}`}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted-surface"
                  >
                    <div>
                      <p className="font-medium text-foreground">{d.application.name}</p>
                      <p className="text-xs text-muted">{formatDate(d.createdAt)}</p>
                    </div>
                    <StatusBadge status={d.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
