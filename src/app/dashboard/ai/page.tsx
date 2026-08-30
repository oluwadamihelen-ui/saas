import { getCurrentBusiness } from "@/lib/current-business";
import { AiChatClient } from "@/components/dashboard/ai/ai-chat-client";

const SUGGESTIONS = [
  "How much did I sell today?",
  "What is my best-selling product?",
  "Which customers haven't bought recently?",
  "What products are low in stock?",
  "What should I promote today?",
  "Show me my sales for this month.",
];

export default async function AiPage() {
  const current = await getCurrentBusiness();
  if (!current) return null;

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Mama AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask Mama anything about {current.business.name}.</p>
      </div>
      <AiChatClient businessId={current.business.id} suggestions={SUGGESTIONS} />
    </div>
  );
}
