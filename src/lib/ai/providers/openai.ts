import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { AiChatMessage, AiGenerateInput, AiGenerateResult, AiProvider, AiToolCall } from "@/lib/ai/types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function toOpenAiMessages(systemPrompt: string, messages: AiChatMessage[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls?.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        })),
      });
    } else {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

function toOpenAiTools(tools: AiGenerateInput["tools"]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function createOpenAiProvider(apiKey: string): AiProvider {
  const client = new OpenAI({ apiKey });

  return {
    name: "openai",
    async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: toOpenAiMessages(input.systemPrompt, input.messages),
        tools: input.tools.length > 0 ? toOpenAiTools(input.tools) : undefined,
      });

      const message = completion.choices[0]?.message;
      if (!message) throw new Error("OpenAI returned no message");

      if (message.tool_calls && message.tool_calls.length > 0) {
        const calls: AiToolCall[] = message.tool_calls
          .filter((c) => c.type === "function")
          .map((c) => ({
            id: c.id,
            name: c.function.name,
            arguments: safeParseJson(c.function.arguments),
          }));
        return { type: "tool_calls", calls };
      }

      return { type: "text", text: message.content ?? "" };
    },
  };
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
