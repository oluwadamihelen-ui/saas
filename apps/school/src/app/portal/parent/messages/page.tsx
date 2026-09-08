import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSchoolUser } from "@/lib/auth/require";
import { listConversationsForUser } from "@/lib/services/messages";
import { formatDate } from "@/lib/utils";

export default async function ParentMessagesPage() {
  const user = await requireSchoolUser();
  const conversations = await listConversationsForUser(user.schoolId, user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Messages</h1>
          <p className="text-sm text-muted">Contact the school office.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/portal/parent/messages/new">New message</Link>
        </Button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet" description="Start one to reach the school office." />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/portal/parent/messages/${c.id}`}
                className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted-surface"
              >
                <div>
                  <p className="font-medium text-foreground">{c.subject}</p>
                  <p className="text-xs text-muted">
                    {c.student ? `Re: ${c.student.firstName} ${c.student.lastName}` : ""}
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
