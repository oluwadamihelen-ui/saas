import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Hosting" };

export default async function AdminHostingPage() {
  await requirePermission(PERMISSIONS.HOSTING_MANAGE);
  const [plans, accounts] = await Promise.all([
    prisma.hostingPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.hostingAccount.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true, hostingPlan: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hosting</h1>
        <p className="mt-1 text-sm text-muted">Plans are configured here; provisioning goes through the hosting provider adapter.</p>
      </div>

      <section>
        <p className="mb-3 text-sm font-semibold text-foreground">Plans</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardContent>
                <p className="font-semibold text-foreground">{plan.name}</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(Number(plan.priceMonthly))}<span className="text-sm text-muted">/mo</span></p>
                <p className="mt-2 text-xs text-muted">
                  {plan.websitesLimit} sites · {plan.storageGB}GB · {plan.bandwidthGB}GB bandwidth
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 text-sm font-semibold text-foreground">Accounts</p>
        {accounts.length === 0 ? (
          <EmptyState title="No hosting accounts yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 text-muted">
                      <Link href={`/admin/hosting/${account.id}`} className="hover:text-accent hover:underline">
                        {account.customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{account.hostingPlan.name}</td>
                    <td className="px-4 py-3 text-muted">{account.primaryDomain ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={account.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
