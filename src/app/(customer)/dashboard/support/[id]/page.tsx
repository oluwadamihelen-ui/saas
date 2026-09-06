import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { replyToTicket } from "../actions";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, customerId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" }, include: { author: true } } },
  });
  if (!ticket) notFound();

  const reply = replyToTicket.bind(null, ticket.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{ticket.subject}</h1>
          <p className="text-xs text-muted">
            {ticket.ticketNumber} · {ticket.category}
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
              message.authorType === "STAFF" ? "border-accent bg-accent-soft" : "ml-auto border-border bg-surface"
            )}
          >
            <p className="mb-1 text-xs font-medium text-muted">
              {message.authorType === "STAFF" ? "Support Team" : message.author.name} · {formatDate(message.createdAt)}
            </p>
            <p className="whitespace-pre-line text-foreground">{message.message}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "CLOSED" && (
        <Card>
          <CardContent>
            <form action={reply} className="space-y-3">
              <Textarea name="message" required rows={3} placeholder="Type your reply..." />
              <Button type="submit" size="sm">
                Send Reply
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
