import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Domains" };

export default async function AdminDomainsPage() {
  await requirePermission(PERMISSIONS.DOMAINS_MANAGE);
  const domains = await prisma.domain.findMany({ orderBy: { createdAt: "desc" }, include: { customer: true } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
      {domains.length === 0 ? (
        <EmptyState title="No domains registered yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Registrar</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {domains.map((domain) => (
                <tr key={domain.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3 font-medium text-foreground">{domain.name}</td>
                  <td className="px-4 py-3 text-muted">{domain.customer.name}</td>
                  <td className="px-4 py-3 text-muted">{domain.registrarProvider}</td>
                  <td className="px-4 py-3 text-muted">{domain.expiresAt ? formatDate(domain.expiresAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={domain.status} />
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
