import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Support" };

export default async function AdminSupportPage() {
  await requirePermission(PERMISSIONS.SUPPORT_MANAGE);
  const tickets = await prisma.supportTicket.findMany({ orderBy: { updatedAt: "desc" }, include: { customer: true } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Support Tickets</h1>
      {tickets.length === 0 ? (
        <EmptyState title="No support tickets" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/support/${ticket.id}`} className="font-medium text-accent">
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{ticket.customer.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ticket.priority} />
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(ticket.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ticket.status} />
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
