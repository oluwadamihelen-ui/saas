import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { listAiConversations, isAiAssistantConfigured } from "@/lib/services/ai-assistant";
import { formatDate } from "@/lib/utils";
import { StartConversationButton } from "./start-conversation-button";

export default async function AssistantPage() {
  const user = await requirePermission(PERMISSIONS.ASSISTANT_USE);

  if (!isAiAssistantConfigured()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Assistant</h1>
        </div>
        <EmptyState
          title="AI assistant isn't configured yet"
          description="Add an OPENAI_API_KEY or ANTHROPIC_API_KEY to this app's .env to turn it on — nothing here fakes a response without one."
        />
      </div>
    );
  }

  const conversations = await listAiConversations(user.schoolId, user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Assistant</h1>
          <p className="text-sm text-muted">Ask about students, attendance, results and finance — scoped to what you can already see.</p>
        </div>
        <StartConversationButton />
      </div>

      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet" description="Start one to ask a question." />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/assistant/${c.id}`}
                className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted-surface"
              >
                <span className="font-medium text-foreground">{c.title}</span>
                <span className="text-xs text-muted">{formatDate(c.updatedAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
