import "server-only";
import { prisma } from "@/lib/prisma";
import { getAIProvider, type ChatMessage, type ContentBlock } from "@/lib/ai/provider";
import { getTool } from "@/lib/ai/tools";

const SYSTEM_PROMPT = `You are Mama, an AI business assistant inside MAMA Business OS. You help a small business owner understand and run their business.

Rules you must always follow:
- Only ever answer business-data questions (sales, orders, customers, inventory, products) by calling the provided tools. Never invent numbers.
- You only ever have access to the current merchant's own business data — never mention or imply access to any other business.
- Keep answers short, warm, and actionable — like a sharp co-founder, not a corporate report.
- For any tool that modifies data (deleting something, creating a segment), you must call it and wait for user confirmation before it takes effect — never claim an action is done until it is confirmed and executed.
- Amounts are in the business's local currency.`;

type PendingConfirmation = { messageId: string; toolName: string; toolInput: Record<string, unknown> };
export type ChatTurnResult = { type: "message"; text: string } | { type: "confirmation"; confirmation: PendingConfirmation };

async function getOrCreateConversation(businessId: string, userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
    if (existing && existing.businessId === businessId) return existing;
  }
  const session = await prisma.aISession.create({ data: { businessId, userId } });
  return prisma.aIConversation.create({ data: { businessId, aiSessionId: session.id } });
}

function rowsToMessages(rows: Array<{ role: string; content: string; toolName: string | null; toolInput: unknown }>): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const row of rows) {
    if (row.role === "USER") {
      messages.push({ role: "user", content: [{ type: "text", text: row.content }] });
    } else if (row.role === "ASSISTANT" && !row.toolName) {
      messages.push({ role: "assistant", content: [{ type: "text", text: row.content }] });
    } else if (row.role === "ASSISTANT" && row.toolName) {
      messages.push({
        role: "assistant",
        content: [{ type: "tool_use", id: row.content, name: row.toolName, input: (row.toolInput as Record<string, unknown>) ?? {} }],
      });
    } else if (row.role === "TOOL") {
      try {
        const parsed = JSON.parse(row.content) as { toolUseId: string; result: unknown };
        messages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: parsed.toolUseId, content: JSON.stringify(parsed.result) }],
        });
      } catch {
        // skip malformed rows
      }
    }
  }
  return messages;
}

export async function runChatTurn(
  businessId: string,
  userId: string,
  conversationId: string | undefined,
  userText: string
): Promise<{ conversationId: string; result: ChatTurnResult }> {
  const conversation = await getOrCreateConversation(businessId, userId, conversationId);

  await prisma.aIMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: userText },
  });

  const result = await advance(businessId, conversation.id);
  return { conversationId: conversation.id, result };
}

async function advance(businessId: string, conversationId: string, maxIterations = 4): Promise<ChatTurnResult> {
  const provider = getAIProvider();

  for (let i = 0; i < maxIterations; i++) {
    const rows = await prisma.aIMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
    const messages = rowsToMessages(rows);

    const response = await provider.send(SYSTEM_PROMPT, messages, true);

    const textBlock = response.content.find((c): c is Extract<ContentBlock, { type: "text" }> => c.type === "text");
    const toolUseBlock = response.content.find((c): c is Extract<ContentBlock, { type: "tool_use" }> => c.type === "tool_use");

    if (toolUseBlock) {
      const tool = getTool(toolUseBlock.name);
      if (!tool) {
        await prisma.aIMessage.create({
          data: { conversationId, role: "ASSISTANT", content: "I tried to use a tool that doesn't exist. Let me try again." },
        });
        continue;
      }

      const assistantRow = await prisma.aIMessage.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: toolUseBlock.id,
          toolName: tool.name,
          toolInput: toolUseBlock.input as never,
        },
      });

      if (tool.destructive) {
        return {
          type: "confirmation",
          confirmation: { messageId: assistantRow.id, toolName: tool.name, toolInput: toolUseBlock.input },
        };
      }

      const parsedInput = tool.inputSchema.safeParse(toolUseBlock.input);
      const output = await tool.handler(businessId, (parsedInput.success ? parsedInput.data : toolUseBlock.input) as never);

      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: "TOOL",
          content: JSON.stringify({ toolUseId: toolUseBlock.id, result: output }),
          toolName: tool.name,
          toolOutput: output as never,
        },
      });
      continue; // loop again so the model can read the tool result
    }

    const text = textBlock?.text ?? "I'm not sure how to help with that — could you rephrase?";
    await prisma.aIMessage.create({ data: { conversationId, role: "ASSISTANT", content: text } });
    return { type: "message", text };
  }

  const fallback = "I looked into a few things but couldn't finish — could you ask that a bit more specifically?";
  await prisma.aIMessage.create({ data: { conversationId, role: "ASSISTANT", content: fallback } });
  return { type: "message", text: fallback };
}

export async function confirmToolCall(
  businessId: string,
  conversationId: string,
  messageId: string,
  approve: boolean
): Promise<ChatTurnResult> {
  const message = await prisma.aIMessage.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) {
    throw new Error("Message not found");
  }

  const tool = getTool(message.toolName ?? "");
  if (!tool) throw new Error("Tool not found");

  if (!approve) {
    await prisma.aIMessage.create({
      data: {
        conversationId,
        role: "TOOL",
        content: JSON.stringify({ toolUseId: message.content, result: { cancelled: true } }),
        toolName: tool.name,
      },
    });
    const text = "No problem — I won't make that change.";
    await prisma.aIMessage.create({ data: { conversationId, role: "ASSISTANT", content: text } });
    return { type: "message", text };
  }

  const parsedInput = tool.inputSchema.safeParse(message.toolInput);
  const output = await tool.handler(businessId, (parsedInput.success ? parsedInput.data : message.toolInput) as never);

  await prisma.aIMessage.create({
    data: {
      conversationId,
      role: "TOOL",
      content: JSON.stringify({ toolUseId: message.content, result: output }),
      toolName: tool.name,
      toolOutput: output as never,
    },
  });

  return advance(businessId, conversationId);
}
