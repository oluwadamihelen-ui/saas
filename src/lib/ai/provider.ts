import "server-only";
import { TOOLS } from "@/lib/ai/tools";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type ChatMessage = { role: "user" | "assistant"; content: ContentBlock[] };

export type ProviderResponse = {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens";
};

export interface AIProvider {
  send(system: string, messages: ChatMessage[], toolsEnabled: boolean): Promise<ProviderResponse>;
}

const ANTHROPIC_TOOLS = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.jsonSchema,
}));

class AnthropicProvider implements AIProvider {
  async send(system: string, messages: ChatMessage[], toolsEnabled: boolean): Promise<ProviderResponse> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.AI_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-sonnet-5",
        max_tokens: 1024,
        system,
        messages,
        ...(toolsEnabled ? { tools: ANTHROPIC_TOOLS } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI provider error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return { content: data.content, stopReason: data.stop_reason };
  }
}

/**
 * Deterministic, keyword-driven fallback used when no AI_API_KEY is
 * configured. It still only ever answers from real tool data — it just
 * picks which tool to call with simple pattern matching instead of an LLM,
 * and formats the tool's result into a sentence. This keeps local/demo use
 * honest per the "never invent business numbers" rule, instead of faking a
 * live AI integration that isn't actually configured.
 */
class MockProvider implements AIProvider {
  async send(_system: string, messages: ChatMessage[]): Promise<ProviderResponse> {
    const last = messages[messages.length - 1];

    // If the previous turn returned tool results, synthesize a text answer from them.
    const toolResults = last.content.filter((c): c is Extract<ContentBlock, { type: "tool_result" }> => c.type === "tool_result");
    if (toolResults.length > 0) {
      const summary = toolResults.map((r) => r.content).join("\n\n");
      return {
        stopReason: "end_turn",
        content: [{ type: "text", text: `Here's what I found:\n\n${summary}` }],
      };
    }

    const userText = last.content
      .filter((c): c is Extract<ContentBlock, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join(" ")
      .toLowerCase();

    const pick = (name: string, input: Record<string, unknown> = {}): ProviderResponse => ({
      stopReason: "tool_use",
      content: [{ type: "tool_use", id: `mock_${Date.now()}`, name, input }],
    });

    if (/today/.test(userText) && /sold|sale|revenue|earn/.test(userText)) return pick("get_today_sales");
    if (/best.?sell|top product|most popular/.test(userText)) return pick("get_top_products");
    if (/profit|margin/.test(userText)) return pick("get_top_products");
    if (/low.?stock|running low|restock/.test(userText)) return pick("get_low_stock_products");
    if (/haven'?t (bought|ordered|purchase)|inactive|lapsed/.test(userText)) return pick("get_customer_segments");
    if (/this month|month'?s sales|monthly sales/.test(userText)) return pick("get_sales_summary", { from: monthStartISO() });
    if (/category|categories/.test(userText)) return pick("get_sales_by_category");
    if (/promote|marketing|message for/.test(userText)) return pick("generate_marketing_message");
    if (/inventory|stock level/.test(userText)) return pick("get_inventory");
    if (/customer/.test(userText)) return pick("get_customers");
    if (/order/.test(userText)) return pick("get_orders");

    return pick("get_business_metrics");
  }
}

function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getAIProvider(): AIProvider {
  if (process.env.AI_PROVIDER === "anthropic" && process.env.AI_API_KEY) {
    return new AnthropicProvider();
  }
  return new MockProvider();
}
