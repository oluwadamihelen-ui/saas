import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Audit Log" };

const PAGE_SIZE = 30;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requirePermission(PERMISSIONS.AUDIT_LOG_VIEW);
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { hotelId: user.hotelId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: { hotelId: user.hotelId } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>

      {items.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No activity recorded yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">By</th>
                  <th className="px-5 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-3 font-medium text-foreground">{log.action.replaceAll(".", " · ").replaceAll("_", " ")}</td>
                    <td className="px-5 py-3 text-muted">{log.resourceType}</td>
                    <td className="px-5 py-3 text-muted">{log.actor?.name ?? "System"}</td>
                    <td className="px-5 py-3 text-muted">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination basePath="/app/audit-log" page={page} pageCount={pageCount} />
        </Card>
      )}
    </div>
  );
}
