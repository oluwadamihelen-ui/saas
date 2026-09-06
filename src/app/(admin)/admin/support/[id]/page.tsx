import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { staffReplyToTicket } from "../actions";

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.SUPPORT_MANAGE);
  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { customer: true, messages: { orderBy: { createdAt: "asc" }, include: { author: true } } },
  });
  if (!ticket) notFound();

  const reply = staffReplyToTicket.bind(null, ticket.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{ticket.subject}</h1>
          <p className="text-xs text-muted">
            {ticket.ticketNumber} · {ticket.customer.name} ({ticket.customer.email})
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="space-y-4">
        {ticket.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-lg border p-4 text-sm",
              message.authorType === "STAFF" ? "ml-auto border-accent bg-accent-soft" : "border-border bg-surface"
            )}
          >
            <p className="mb-1 text-xs font-medium text-muted">
              {message.authorType === "STAFF" ? message.author.name : ticket.customer.name} · {formatDate(message.createdAt)}
            </p>
            <p className="whitespace-pre-line text-foreground">{message.message}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent>
          <form action={reply} className="space-y-3">
            <Textarea name="message" required rows={4} placeholder="Reply to customer..." />
            <div className="flex items-center gap-3">
              <Select name="status" defaultValue={ticket.status} className="w-auto">
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm">
                Send Reply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
