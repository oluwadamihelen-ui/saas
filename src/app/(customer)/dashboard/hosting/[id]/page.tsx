import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { decryptSecret } from "@/lib/security/encryption";
import { ChangePlanForm } from "./change-plan-form";
import { cancelHosting } from "../actions";

export default async function HostingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const account = await prisma.hostingAccount.findFirst({
    where: { id, customerId: user.id },
    include: { hostingPlan: true },
  });
  if (!account) notFound();

  const [plans, subscription] = await Promise.all([
    prisma.hostingPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.subscription.findFirst({ where: { type: "HOSTING", referenceId: account.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const usage = account.usage as { storageUsedGB?: number; bandwidthUsedGB?: number; websitesUsed?: number } | null;
  const cancel = cancelHosting.bind(null, account.id);
  const initialPassword = account.initialCredentialEncrypted ? decryptSecret(account.initialCredentialEncrypted) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{account.hostingPlan.name}</h1>
          <p className="mt-1 text-sm text-muted">{account.primaryDomain ?? "No domain assigned"}</p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent>
              <p className="mb-3 text-sm font-semibold text-foreground">Usage</p>
              <dl className="grid grid-cols-2 gap-y-2 text-xs text-muted">
                <dt>Storage</dt>
                <dd className="text-foreground">
                  {usage?.storageUsedGB ?? 0}GB / {account.hostingPlan.storageGB}GB
                </dd>
                <dt>Bandwidth</dt>
                <dd className="text-foreground">
                  {usage?.bandwidthUsedGB ?? 0}GB / {account.hostingPlan.bandwidthGB}GB
                </dd>
                <dt>Websites</dt>
                <dd className="text-foreground">
                  {usage?.websitesUsed ?? 0} / {account.hostingPlan.websitesLimit}
                </dd>
              </dl>
            </CardContent>
          </Card>

          {account.controlPanelUrl && (
            <Card>
              <CardContent>
                <p className="mb-3 text-sm font-semibold text-foreground">Control Panel Access</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                  <dt className="text-muted">Login URL</dt>
                  <dd>
                    <a href={account.controlPanelUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {account.controlPanelUrl}
                    </a>
                  </dd>
                  <dt className="text-muted">Username</dt>
                  <dd className="font-mono text-foreground">{account.providerAccountId}</dd>
                  {initialPassword && (
                    <>
                      <dt className="text-muted">Password</dt>
                      <dd className="font-mono text-foreground">{initialPassword}</dd>
                    </>
                  )}
                </dl>
                <p className="mt-3 text-xs text-muted">
                  Save this somewhere safe -- this is your login for the hosting control panel directly, separate from your BridgeCodes account.
                </p>
              </CardContent>
            </Card>
          )}

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
                <p className="text-xs text-muted">No active subscription.</p>
              )}

              {account.status !== "TERMINATED" && (
                <form action={cancel} className="mt-4">
                  <Button size="sm" variant="destructive" type="submit">
                    Cancel Hosting
                  </Button>
                </form>
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
              A plan change takes effect immediately; the new price applies starting your next billing date.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
