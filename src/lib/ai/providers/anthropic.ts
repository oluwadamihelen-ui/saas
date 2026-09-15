import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import type { AiChatMessage, AiGenerateInput, AiGenerateResult, AiProvider, AiToolCall } from "@/lib/ai/types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_TOKENS = 1024;

function toAnthropicMessages(messages: AiChatMessage[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const blocks: MessageParam["content"] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const call of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
      }
      out.push({ role: "assistant", content: blocks.length > 0 ? blocks : "" });
    } else {
      out.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
      });
    }
  }
  return out;
}

function toAnthropicTools(tools: AiGenerateInput["tools"]): Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Tool["input_schema"],
  }));
}

export function createAnthropicProvider(apiKey: string): AiProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: input.systemPrompt,
        messages: toAnthropicMessages(input.messages),
        tools: input.tools.length > 0 ? toAnthropicTools(input.tools) : undefined,
      });

      const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
      if (toolUseBlocks.length > 0) {
        const calls: AiToolCall[] = toolUseBlocks.map((b) => ({
          id: b.id,
          name: b.name,
          arguments: (b.input as Record<string, unknown>) ?? {},
        }));
        return { type: "tool_calls", calls };
      }

      const text = response.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { type: "text", text };
    },
  };
}
