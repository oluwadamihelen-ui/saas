import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { promoteToDeveloper, revertToCustomer, suspendUser, reactivateUser, sendPasswordResetEmail } from "../actions";

const ROLE_VARIANT: Record<string, "neutral" | "accent"> = { CUSTOMER: "neutral", DEVELOPER: "accent" };
const ROLE_LABEL: Record<string, string> = { CUSTOMER: "Buyer", DEVELOPER: "Developer" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.CUSTOMERS_VIEW);
  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      role: true,
      orders: { orderBy: { createdAt: "desc" }, take: 10 },
      deployments: { orderBy: { createdAt: "desc" }, take: 10, include: { application: true } },
      domains: true,
      licenses: { include: { application: true } },
      createdApplications: { orderBy: { createdAt: "desc" } },
      commissions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!customer) notFound();

  const isDeveloper = customer.role.key === "DEVELOPER";
  const isManageableRole = customer.role.key === "CUSTOMER" || customer.role.key === "DEVELOPER";
  const pendingCommissions = customer.commissions.filter((c) => c.status === "PENDING").reduce((sum, c) => sum + Number(c.amount), 0);
  const paidCommissions = customer.commissions.filter((c) => c.status === "PAID").reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <Badge variant={ROLE_VARIANT[customer.role.key] ?? "neutral"}>{ROLE_LABEL[customer.role.key] ?? customer.role.key}</Badge>
            <Badge variant={customer.status === "ACTIVE" ? "success" : "danger"}>{customer.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {customer.email} · Joined {formatDate(customer.createdAt)}
          </p>
        </div>

        {isManageableRole && (
          <div className="flex flex-wrap items-center gap-2">
            {customer.role.key === "CUSTOMER" ? (
              <form action={promoteToDeveloper.bind(null, customer.id)}>
                <Button type="submit" size="sm" variant="outline">
                  Make Developer
                </Button>
              </form>
            ) : (
              <form action={revertToCustomer.bind(null, customer.id)}>
                <Button type="submit" size="sm" variant="outline">
                  Revert to Buyer
                </Button>
              </form>
            )}
            {customer.status === "ACTIVE" ? (
              <form action={suspendUser.bind(null, customer.id)}>
                <Button type="submit" size="sm" variant="destructive">
                  Suspend
                </Button>
              </form>
            ) : (
              <form action={reactivateUser.bind(null, customer.id)}>
                <Button type="submit" size="sm" variant="secondary">
                  Reactivate
                </Button>
              </form>
            )}
            <form action={sendPasswordResetEmail.bind(null, customer.id)}>
              <Button type="submit" size="sm" variant="outline">
                Send Password Reset Email
              </Button>
            </form>
          </div>
        )}
      </div>

      {isDeveloper && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Submitted Applications</p>
              {customer.createdApplications.length === 0 ? (
                <p className="text-sm text-muted">No applications submitted yet.</p>
              ) : (
                <div className="space-y-2">
                  {customer.createdApplications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <span>{app.name}</span>
                      <StatusBadge status={app.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Commissions</p>
              <div className="mb-3 flex gap-4 text-sm">
                <span className="text-muted">
                  Pending: <span className="font-medium text-foreground">{formatCurrency(pendingCommissions, "USD")}</span>
                </span>
                <span className="text-muted">
                  Paid: <span className="font-medium text-foreground">{formatCurrency(paidCommissions, "USD")}</span>
                </span>
              </div>
              {customer.commissions.length === 0 ? (
                <p className="text-sm text-muted">No commissions yet.</p>
              ) : (
                <div className="space-y-2">
                  {customer.commissions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <span>{formatCurrency(Number(c.amount), "USD")}</span>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
