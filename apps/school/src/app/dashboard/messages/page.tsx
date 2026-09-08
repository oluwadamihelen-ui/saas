import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listConversationsForStaff } from "@/lib/services/messages";
import { formatDate } from "@/lib/utils";

export default async function MessagesPage() {
  const user = await requirePermission(PERMISSIONS.MESSAGES_VIEW);
  const conversations = await listConversationsForStaff(user.schoolId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Messages</h1>
        <p className="text-sm text-muted">Conversations started by parents and students.</p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet" />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/messages/${c.id}`}
                className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted-surface"
              >
                <div>
                  <p className="font-medium text-foreground">{c.subject}</p>
                  <p className="text-xs text-muted">
                    {c.initiatedBy.name}
                    {c.student ? ` · re: ${c.student.firstName} ${c.student.lastName}` : ""}
                    {c.messages[0] ? ` · ${formatDate(c.messages[0].createdAt)}` : ""}
                  </p>
                </div>
                <Badge variant={c.status === "OPEN" ? "accent" : "neutral"}>{c.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
