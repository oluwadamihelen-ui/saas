import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { getAiConversation, isAiAssistantConfigured } from "@/lib/services/ai-assistant";
import { ToolCallCard } from "./tool-call-card";
import { ChatForm } from "./chat-form";

export default async function AssistantConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.ASSISTANT_USE);
  const conversation = await getAiConversation(user.schoolId, user.id, id);
  if (!conversation) notFound();

  const configured = isAiAssistantConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/dashboard/assistant" className="text-sm text-muted hover:text-foreground">
        &larr; Back to conversations
      </Link>
      <h1 className="text-xl font-semibold text-foreground">{conversation.title}</h1>

      <div className="space-y-3">
        {conversation.messages.map((m) => {
          if (m.role === "USER") {
            return (
              <div key={m.id} className="ml-auto max-w-md rounded-lg bg-accent px-4 py-2 text-sm text-accent-foreground">
                {m.content}
              </div>
            );
          }
          if (m.role === "ASSISTANT") {
            return (
              <Card key={m.id} className="max-w-lg">
                <CardContent className="whitespace-pre-line text-sm text-foreground">{m.content}</CardContent>
              </Card>
            );
          }
          return <ToolCallCard key={m.id} conversationId={conversation.id} message={m} />;
        })}
      </div>

      {configured ? (
        <ChatForm conversationId={conversation.id} />
      ) : (
        <p className="text-sm text-muted">
          The AI provider isn&apos;t configured, so this conversation can&apos;t continue right now.
        </p>
      )}
    </div>
  );
}
