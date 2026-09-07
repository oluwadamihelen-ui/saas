import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 10 },
      deployments: { orderBy: { createdAt: "desc" }, take: 10, include: { application: true } },
      domains: true,
      licenses: { include: { application: true } },
    },
  });
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {customer.email} · Joined {formatDate(customer.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-foreground">Licenses</p>
            {customer.licenses.length === 0 ? (
              <p className="text-sm text-muted">No licenses.</p>
            ) : (
              <div className="space-y-2">
                {customer.licenses.map((license) => (
                  <div key={license.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>{license.application.name}</span>
                    <StatusBadge status={license.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-foreground">Orders</p>
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted">No orders.</p>
            ) : (
              <div className="space-y-2">
                {customer.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>{order.orderNumber}</span>
                    <span className="font-medium">{formatCurrency(Number(order.total), order.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-foreground">Deployments</p>
            {customer.deployments.length === 0 ? (
              <p className="text-sm text-muted">No deployments.</p>
            ) : (
              <div className="space-y-2">
                {customer.deployments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>{d.application.name}</span>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold text-foreground">Domains</p>
            {customer.domains.length === 0 ? (
              <p className="text-sm text-muted">No domains.</p>
            ) : (
              <div className="space-y-2">
                {customer.domains.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>{d.name}</span>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
