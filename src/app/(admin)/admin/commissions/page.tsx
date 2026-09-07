import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { markCommissionPaid } from "./actions";

export const metadata: Metadata = { title: "Commissions" };

export default async function AdminCommissionsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);

  const commissions = await prisma.commission.findMany({
    orderBy: { createdAt: "desc" },
    include: { developer: true, application: true, order: true },
  });

  const pendingTotal = commissions.filter((c) => c.status === "PENDING").reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
        <p className="text-sm text-muted">
          Pending payout: <span className="font-semibold text-foreground">{formatCurrency(pendingTotal)}</span>
        </p>
      </div>

      {commissions.length === 0 ? (
        <EmptyState title="No commissions yet" description="Commissions appear here once a developer-authored application sells." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Developer</th>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {commissions.map((commission) => {
                const markPaid = markCommissionPaid.bind(null, commission.id);
                return (
                  <tr key={commission.id} className="hover:bg-muted-surface">
                    <td className="px-4 py-3 text-muted">{commission.developer.name}</td>
                    <td className="px-4 py-3 text-muted">{commission.application.name}</td>
                    <td className="px-4 py-3 text-muted">{commission.order.orderNumber}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {formatCurrency(Number(commission.amount))}
                      <span className="ml-1 text-xs text-muted">({(Number(commission.rate) * 100).toFixed(0)}%)</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={commission.status} />
                      {commission.paidAt && <p className="mt-0.5 text-xs text-muted">{formatDate(commission.paidAt)}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {commission.status === "PENDING" && (
                        <form action={markPaid}>
                          <Button type="submit" size="sm" variant="secondary">
                            Mark Paid
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
