"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "confirmation"; messageId: string; toolName: string; toolInput: Record<string, unknown>; resolved?: "approved" | "cancelled" };

export function AiChatClient({ businessId, suggestions }: { businessId: string; suggestions: string[] }) {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  async function send(text: string) {
    if (!text.trim()) return;
    setEntries((prev) => [...prev, { kind: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Mama couldn't respond right now");
        return;
      }
      setConversationId(data.conversationId);
      applyResult(data);
    } finally {
      setLoading(false);
    }
  }

  function applyResult(data: { type: string; text?: string; confirmation?: { messageId: string; toolName: string; toolInput: Record<string, unknown> } }) {
    if (data.type === "confirmation" && data.confirmation) {
      setEntries((prev) => [...prev, { kind: "confirmation", ...data.confirmation! }]);
    } else if (data.type === "message" && data.text) {
      setEntries((prev) => [...prev, { kind: "assistant", text: data.text! }]);
    }
  }

  async function respondToConfirmation(messageId: string, approve: boolean) {
    setEntries((prev) =>
      prev.map((e) => (e.kind === "confirmation" && e.messageId === messageId ? { ...e, resolved: approve ? "approved" : "cancelled" } : e))
    );
    setLoading(true);
    try {
      const res = await fetch("/api/ai/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, conversationId, messageId, approve }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not process that");
        return;
      }
      applyResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {entries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Ask Mama about your sales, customers, inventory, or ask her to draft a marketing message.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {entries.map((entry, idx) => {
          if (entry.kind === "user") {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {entry.text}
                </div>
              </div>
            );
          }
          if (entry.kind === "assistant") {
            return (
              <div key={idx} className="flex justify-start">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm">
                  {entry.text}
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="flex justify-start">
              <Card className="max-w-[85%] border-amber-200 bg-amber-50">
                <CardContent className="pt-4 text-sm">
                  <p>
                    I can run <span className="font-semibold">{describeTool(entry.toolName, entry.toolInput)}</span>. This
                    will change your business data. Continue?
                  </p>
                  {!entry.resolved ? (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => respondToConfirmation(entry.messageId, true)}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondToConfirmation(entry.messageId, false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {entry.resolved === "approved" ? "Confirmed" : "Cancelled"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-muted-foreground">Mama is thinking…</div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Mama anything about your business…"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} className={cn(loading && "opacity-60")}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function describeTool(name: string, input: Record<string, unknown>) {
  if (name === "delete_product") return `delete "${input.productName}"`;
  if (name === "create_customer_segment") return `create the segment "${input.name}"`;
  return name.replace(/_/g, " ");
}
