import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function AdminSubscriptionsPage() {
  await requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE);
  const subscriptions = await prisma.subscription.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
      {subscriptions.length === 0 ? (
        <EmptyState title="No subscriptions yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Next Billing</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3 text-muted">{sub.customer.name}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{sub.type}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(sub.amount), sub.currency)}/{sub.billingCycle === "MONTHLY" ? "mo" : "yr"}</td>
                  <td className="px-4 py-3 text-muted">{sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
