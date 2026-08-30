import "server-only";
import { TOOLS } from "@/lib/ai/tools";
import { formatCurrency, formatNumber } from "@/lib/utils";

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

    // If the previous turn returned tool results, synthesize a natural-language
    // answer from them — never just echo the raw JSON back to the merchant.
    const toolResults = last.content.filter((c): c is Extract<ContentBlock, { type: "tool_result" }> => c.type === "tool_result");
    if (toolResults.length > 0) {
      const sentences = toolResults.map((r) => {
        const toolName = findToolNameForResult(messages, r.tool_use_id);
        let parsed: unknown;
        try {
          parsed = JSON.parse(r.content);
        } catch {
          parsed = r.content;
        }
        return formatToolResult(toolName, parsed);
      });
      return {
        stopReason: "end_turn",
        content: [{ type: "text", text: sentences.join("\n\n") }],
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
    if (/low.*stock|running low|restock/.test(userText)) return pick("get_low_stock_products");
    // Message-drafting intent takes priority over the plain segment-lookup
    // check below, since "create a message for customers who haven't
    // bought..." mentions both.
    if (/(create|draft|write|generate).*message|promote|marketing|message for/.test(userText)) {
      const segment = /haven'?t (bought|ordered|purchase)|inactive|lapsed/.test(userText) ? "INACTIVE" : undefined;
      return pick("generate_marketing_message", segment ? { segment } : {});
    }
    if (/haven'?t (bought|ordered|purchase)|inactive|lapsed/.test(userText)) return pick("get_customer_segments");
    if (/this month|month'?s sales|monthly sales/.test(userText)) return pick("get_sales_summary", { from: monthStartISO() });
    if (/category|categories/.test(userText)) return pick("get_sales_by_category");
    if (/inventory|stock level/.test(userText)) return pick("get_inventory");
    if (/customer/.test(userText)) return pick("get_customers");
    if (/order/.test(userText)) return pick("get_orders");

    return pick("get_business_metrics");
  }
}

function findToolNameForResult(messages: ChatMessage[], toolUseId: string): string | undefined {
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === "tool_use" && block.id === toolUseId) return block.name;
    }
  }
  return undefined;
}

/** Turns a tool's raw JSON result into a sentence a merchant would actually want to read. */
function formatToolResult(toolName: string | undefined, data: unknown): string {
  const d = data as Record<string, unknown> | unknown[] | null;

  switch (toolName) {
    case "get_today_sales":
    case "get_sales_summary": {
      const r = d as { revenue: number; orderCount: number; avgOrderValue: number; uniqueCustomers: number };
      if (!r.orderCount) return "No paid orders in that period yet.";
      return `You made ${formatCurrency(r.revenue)} from ${formatNumber(r.orderCount)} order${r.orderCount === 1 ? "" : "s"} (average order value ${formatCurrency(r.avgOrderValue)}, ${formatNumber(r.uniqueCustomers)} customer${r.uniqueCustomers === 1 ? "" : "s"}).`;
    }
    case "get_business_metrics": {
      const r = d as { todaysSales: number; todaysOrders: number; totalCustomers: number; avgOrderValue: number };
      return `Today: ${formatCurrency(r.todaysSales)} from ${formatNumber(r.todaysOrders)} order${r.todaysOrders === 1 ? "" : "s"}. You have ${formatNumber(r.totalCustomers)} customer${r.totalCustomers === 1 ? "" : "s"} in total, with an average order value of ${formatCurrency(r.avgOrderValue)}.`;
    }
    case "get_orders": {
      const rows = (d as Array<{ orderNumber: string; status: string; total: string }>) ?? [];
      if (rows.length === 0) return "No orders match that yet.";
      const lines = rows.slice(0, 10).map((o) => `• ${o.orderNumber} — ${o.status} — ${formatCurrency(o.total)}`);
      return [`${rows.length} order${rows.length === 1 ? "" : "s"}:`, ...lines].join("\n");
    }
    case "get_order": {
      if (!d) return "I couldn't find that order.";
      const o = d as { orderNumber: string; status: string; total: string };
      return `Order ${o.orderNumber} is ${o.status} — total ${formatCurrency(o.total)}.`;
    }
    case "get_customers": {
      const rows = (d as Array<{ name: string | null; phone: string; stats: { totalOrders: number; totalSpent: number } }>) ?? [];
      if (rows.length === 0) return "No customers yet.";
      const lines = rows.slice(0, 10).map((c) => `• ${c.name ?? c.phone} — ${c.stats.totalOrders} orders, ${formatCurrency(c.stats.totalSpent)} lifetime`);
      return [`${rows.length} customer${rows.length === 1 ? "" : "s"}:`, ...lines].join("\n");
    }
    case "get_customer": {
      if (!d) return "I couldn't find a customer with that phone number.";
      const c = d as { name: string | null; phone: string; stats: { totalOrders: number; totalSpent: number } };
      return `${c.name ?? c.phone}: ${c.stats.totalOrders} orders, ${formatCurrency(c.stats.totalSpent)} lifetime value.`;
    }
    case "get_customer_segments": {
      const r = d as { vip: number; returning: number; new: number; inactive: number; total: number };
      return `Out of ${formatNumber(r.total)} customers: ${formatNumber(r.vip)} VIP, ${formatNumber(r.returning)} returning, ${formatNumber(r.new)} new, and ${formatNumber(r.inactive)} inactive (haven't ordered in 60+ days).`;
    }
    case "get_top_products": {
      const rows = (d as Array<{ productName: string; unitsSold: number; revenue: number }>) ?? [];
      if (rows.length === 0) return "No product sales in that period yet.";
      const lines = rows.map((p, i) => `${i + 1}. ${p.productName} — ${formatCurrency(p.revenue)} (${formatNumber(p.unitsSold)} units)`);
      return ["Your top products:", ...lines].join("\n");
    }
    case "get_product_performance": {
      if (!d) return "I couldn't find a product with that name.";
      const p = d as { product: string; unitsSold: number; revenue: number; currentStock: number };
      return `${p.product}: ${formatNumber(p.unitsSold)} units sold, ${formatCurrency(p.revenue)} revenue, ${formatNumber(p.currentStock)} currently in stock.`;
    }
    case "get_inventory": {
      const r = d as { totalProducts: number; totalUnits: number; inventoryValue: number; lowStockCount: number; outOfStockCount: number };
      return `${formatNumber(r.totalProducts)} products, ${formatNumber(r.totalUnits)} units in stock worth ${formatCurrency(r.inventoryValue)}. ${formatNumber(r.lowStockCount)} low on stock, ${formatNumber(r.outOfStockCount)} out of stock.`;
    }
    case "get_low_stock_products": {
      const rows = (d as Array<{ name: string; stockQuantity: number; lowStockThreshold: number }>) ?? [];
      if (rows.length === 0) return "Nothing is low on stock right now.";
      const lines = rows.map((p) => `• ${p.name} — ${formatNumber(p.stockQuantity)} left (threshold ${formatNumber(p.lowStockThreshold)})`);
      return ["⚠️ Low on stock:", ...lines].join("\n");
    }
    case "get_sales_by_category": {
      const rows = (d as Array<{ category: string; revenue: number }>) ?? [];
      if (rows.length === 0) return "No category sales in that period yet.";
      const total = rows.reduce((s, r) => s + r.revenue, 0);
      const lines = rows.map((r) => `• ${r.category} — ${formatCurrency(r.revenue)} (${total > 0 ? Math.round((r.revenue / total) * 100) : 0}%)`);
      return ["Revenue by category:", ...lines].join("\n");
    }
    case "generate_marketing_message": {
      const r = d as { draft: string };
      return `Here's a draft:\n\n"${r.draft}"`;
    }
    case "create_customer_segment": {
      const r = d as { name: string };
      return `Done — created the "${r.name}" segment.`;
    }
    case "delete_product": {
      const r = d as { deleted?: string; error?: string };
      return r.deleted ? `Done — deleted "${r.deleted}" from your catalog.` : r.error ?? "Couldn't delete that product.";
    }
    default:
      return typeof d === "string" ? d : JSON.stringify(d);
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
