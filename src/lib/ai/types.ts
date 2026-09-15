/// Provider-neutral shapes so src/lib/ai/providers/openai.ts and anthropic.ts
/// can translate to/from their own wire formats, and nothing outside this
/// folder needs to know which one is in use — the same separation the
/// payment provider abstraction (src/lib/payments/) uses for gateways.

export interface AiToolDefinition {
  name: string;
  description: string;
  /// JSON Schema for the tool's arguments (an "object" schema with
  /// "properties"/"required", same shape both providers expect).
  parameters: Record<string, unknown>;
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AiChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: AiToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

export interface AiGenerateInput {
  systemPrompt: string;
  messages: AiChatMessage[];
  tools: AiToolDefinition[];
}

export type AiGenerateResult = { type: "text"; text: string } | { type: "tool_calls"; calls: AiToolCall[] };

export interface AiProvider {
  name: string;
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;
}
