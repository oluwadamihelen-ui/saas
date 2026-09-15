import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireSchoolUser } from "@/lib/auth/require";
import { getConversationForViewer } from "@/lib/services/messages";
import { formatDate } from "@/lib/utils";
import { ReplyForm } from "./reply-form";

export default async function ParentConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSchoolUser();
  const conversation = await getConversationForViewer(user.schoolId, id, { userId: user.id, isStaff: false });
  if (!conversation) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/portal/parent/messages" className="text-sm text-muted hover:text-foreground">
        &larr; Back to messages
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{conversation.subject}</h1>
          {conversation.student && (
            <p className="text-sm text-muted">Re: {conversation.student.firstName} {conversation.student.lastName}</p>
          )}
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

      <ReplyForm conversationId={conversation.id} />
    </div>
  );
}
