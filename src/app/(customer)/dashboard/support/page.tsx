import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireUser();
  const tickets = await prisma.supportTicket.findMany({ where: { customerId: user.id }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <Button asChild size="sm">
          <Link href="/dashboard/support/new">
            <Plus className="h-4 w-4" /> New Ticket
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-8 w-8" />} title="No support tickets" description="Open a ticket if you need help with anything." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-border bg-muted-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-muted-surface">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/support/${ticket.id}`} className="font-medium text-accent">
                      {ticket.subject}
                    </Link>
                    <p className="text-xs text-muted">{ticket.ticketNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{ticket.category}</td>
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
