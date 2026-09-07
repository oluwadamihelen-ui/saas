import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Deployments" };

export default async function AdminDeploymentsPage() {
  await requirePermission(PERMISSIONS.DEPLOYMENTS_VIEW);
  const deployments = await prisma.deployment.findMany({
    orderBy: { createdAt: "desc" },
    include: { application: true, customer: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
      {deployments.length === 0 ? (
        <EmptyState title="No deployments yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deployments.map((d) => (
                <tr key={d.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/deployments/${d.id}`} className="font-medium text-accent">
                      {d.application.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{d.customer.name}</td>
                  <td className="px-4 py-3 text-muted">{d.type.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.healthStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
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
