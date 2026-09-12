import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getConversationForViewer } from "@/lib/services/messages";
import { formatDate } from "@/lib/utils";
import { ReplyForm } from "./reply-form";
import { closeConversationAction, reopenConversationAction } from "../actions";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.MESSAGES_VIEW);
  const [conversation, perms] = await Promise.all([
    getConversationForViewer(user.schoolId, id, { userId: user.id, isStaff: true }),
    getUserPermissions(user.id),
  ]);
  if (!conversation) notFound();

  const canManage = perms.has(PERMISSIONS.MESSAGES_MANAGE);

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/dashboard/messages" className="text-sm text-muted hover:text-foreground">
        &larr; Back to messages
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{conversation.subject}</h1>
          <p className="text-sm text-muted">
            {conversation.initiatedBy.name}
            {conversation.student ? ` · re: ${conversation.student.firstName} ${conversation.student.lastName}` : ""}
          </p>
        </div>
        <Badge variant={conversation.status === "OPEN" ? "accent" : "neutral"}>{conversation.status}</Badge>
      </div>

      <div className="space-y-3">
        {conversation.messages.map((m) => (
          <Card key={m.id}>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-medium text-foreground">{m.sender.name}</span>
                <span>{formatDate(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground">{m.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canManage && (
        <>
          <div className="flex items-center gap-2">
            {conversation.status === "OPEN" ? (
              <form action={closeConversationAction.bind(null, conversation.id)}>
                <Button type="submit" size="sm" variant="secondary">Mark resolved</Button>
              </form>
            ) : (
              <form action={reopenConversationAction.bind(null, conversation.id)}>
                <Button type="submit" size="sm" variant="secondary">Reopen</Button>
              </form>
            )}
          </div>
          <ReplyForm conversationId={conversation.id} />
        </>
      )}
    </div>
  );
}
