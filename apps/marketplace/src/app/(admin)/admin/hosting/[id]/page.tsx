import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ChangePlanForm } from "./change-plan-form";
import { suspendAdmin, unsuspendAdmin, terminateAdmin } from "../actions";

export default async function AdminHostingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.HOSTING_MANAGE);
  const { id } = await params;

  const account = await prisma.hostingAccount.findUnique({
    where: { id },
    include: { customer: true, hostingPlan: true },
  });
  if (!account) notFound();

  const [plans, subscription] = await Promise.all([
    prisma.hostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.subscription.findFirst({ where: { type: "HOSTING", referenceId: account.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const usage = account.usage as { storageUsedGB?: number; bandwidthUsedGB?: number; websitesUsed?: number } | null;

  const suspend = suspendAdmin.bind(null, account.id);
  const unsuspend = unsuspendAdmin.bind(null, account.id);
  const terminate = terminateAdmin.bind(null, account.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{account.customer.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {account.hostingPlan.name} · {account.primaryDomain ?? "no domain attached"}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Account</p>
              <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted">
                <dt>Provider</dt>
                <dd className="text-foreground">{account.provider}</dd>
                <dt>Created</dt>
                <dd className="text-foreground">{formatDate(account.createdAt)}</dd>
                <dt>Storage used</dt>
                <dd className="text-foreground">
                  {usage?.storageUsedGB ?? "—"}GB / {account.hostingPlan.storageGB}GB
                </dd>
                <dt>Bandwidth used</dt>
                <dd className="text-foreground">
                  {usage?.bandwidthUsedGB ?? "—"}GB / {account.hostingPlan.bandwidthGB}GB
                </dd>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {account.status === "SUSPENDED" ? (
                  <form action={unsuspend}>
                    <Button size="sm" type="submit">
                      Unsuspend
                    </Button>
                  </form>
                ) : account.status === "ACTIVE" ? (
                  <form action={suspend}>
                    <Button size="sm" variant="secondary" type="submit">
                      Suspend
                    </Button>
                  </form>
                ) : null}
                {account.status !== "TERMINATED" && (
                  <form action={terminate}>
                    <Button size="sm" variant="destructive" type="submit">
                      Terminate
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Billing</p>
              {subscription ? (
                <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted">
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={subscription.status} />
                  </dd>
                  <dt>Amount</dt>
                  <dd className="text-foreground">{formatCurrency(Number(subscription.amount), subscription.currency)}/mo</dd>
                  <dt>Next billing date</dt>
                  <dd className="text-foreground">{subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : "—"}</dd>
                </dl>
              ) : (
                <p className="text-xs text-muted">No subscription record for this account.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            <p className="mb-4 text-sm font-semibold text-foreground">Plan</p>
            <ChangePlanForm
              accountId={account.id}
              currentPlanId={account.hostingPlanId}
              plans={plans.map((p) => ({ id: p.id, name: p.name, priceMonthly: Number(p.priceMonthly) }))}
            />
            <p className="mt-3 text-xs text-muted">
              A plan change takes effect immediately on the account; the new price applies starting the next billing cycle.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
