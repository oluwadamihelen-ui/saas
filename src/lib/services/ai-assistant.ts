import "server-only";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { getToolsForPermissions, getToolByName } from "@/lib/ai/tools";
import type { AiChatMessage, AiToolCall } from "@/lib/ai/types";
import type { AiMessage, Prisma } from "@/generated/prisma/client";

const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT = `You are Schoolum AI, this school's intelligent assistant. You answer questions about \
this school's own data — students, attendance, results, and finance — using the tools you're given. \
Never invent numbers or facts; if a tool doesn't cover something, say so plainly instead of guessing. \
The tools you see are already filtered to what this specific user is allowed to access, so if a tool \
isn't available, the answer is "I don't have permission to check that" rather than trying to work \
around it. Keep answers short and concrete. When you call a tool that changes data (not just reads \
it), the user will be shown a confirmation before it actually runs — you don't need to ask them to \
confirm in words, just call the tool.`;

export function isAiAssistantConfigured(): boolean {
  return getAiProvider() !== null;
}

const AI_CONVERSATION_PAGE_SIZE = 20;

export async function listAiConversations(schoolId: string, userId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where = { schoolId, userId };
  const [conversations, total] = await Promise.all([
    prisma.aiConversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (currentPage - 1) * AI_CONVERSATION_PAGE_SIZE,
      take: AI_CONVERSATION_PAGE_SIZE,
    }),
    prisma.aiConversation.count({ where }),
  ]);
  return { conversations, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / AI_CONVERSATION_PAGE_SIZE)) };
}

export async function getAiConversation(schoolId: string, userId: string, id: string) {
  return prisma.aiConversation.findFirst({
    where: { schoolId, userId, id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function createAiConversation(schoolId: string, userId: string) {
  return prisma.aiConversation.create({ data: { schoolId, userId } });
}

/// Reconstructs the neutral AiChatMessage[] shape both providers expect
/// from stored rows. A run of consecutive TOOL rows is one assistant
/// "tool_calls" turn (that's how sendMessage/confirmToolCall write them),
/// so it's replayed as one synthesized assistant message naming those
/// calls, followed by one tool-result message per row that already has an
/// outcome. A still-PROPOSED row (awaiting confirmation) never reaches
/// here in practice — sendMessage returns to the caller as soon as one
/// shows up, before calling the provider again.
function rowsToChatMessages(rows: AiMessage[]): AiChatMessage[] {
  const out: AiChatMessage[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.role === "USER") {
      out.push({ role: "user", content: row.content ?? "" });
      i++;
      continue;
    }
    if (row.role === "ASSISTANT") {
      out.push({ role: "assistant", content: row.content });
      i++;
      continue;
    }

    const batch: AiMessage[] = [];
    while (i < rows.length && rows[i].role === "TOOL") {
      batch.push(rows[i]);
      i++;
    }
    out.push({
      role: "assistant",
      content: null,
      toolCalls: batch.map((r) => ({ id: r.id, name: r.toolName ?? "", arguments: (r.toolArgs as Record<string, unknown>) ?? {} })),
    });
    for (const r of batch) {
      if (r.toolStatus === "EXECUTED") {
        out.push({ role: "tool", toolCallId: r.id, toolName: r.toolName ?? "", content: JSON.stringify(r.toolResult ?? {}) });
      } else if (r.toolStatus === "DECLINED") {
        out.push({ role: "tool", toolCallId: r.id, toolName: r.toolName ?? "", content: JSON.stringify({ declined: true }) });
      }
    }
  }
  return out;
}

async function runReadTool(schoolId: string, userId: string, call: AiToolCall): Promise<{ result: unknown; error?: string }> {
  const tool = getToolByName(call.name);
  if (!tool) return { result: null, error: `Unknown tool: ${call.name}` };
  try {
    const result = await tool.execute(schoolId, userId, call.arguments);
    await logAudit({
      schoolId,
      userId,
      action: "ai.tool_call",
      resourceType: call.name,
      newValue: { arguments: call.arguments, result } as unknown as Prisma.InputJsonValue,
    });
    return { result };
  } catch (error) {
    return { result: null, error: error instanceof Error ? error.message : "Tool failed." };
  }
}

async function generateFollowUp(schoolId: string, conversationId: string, perms: Set<string>) {
  const provider = getAiProvider();
  if (!provider) return;
  const history = await prisma.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  const tools = getToolsForPermissions(perms).map((t) => t.definition);
  const result = await provider.generate({ systemPrompt: SYSTEM_PROMPT, messages: rowsToChatMessages(history), tools });
  if (result.type === "text") {
    await prisma.aiMessage.create({ data: { conversationId, role: "ASSISTANT", content: result.text } });
  }
  await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
}

export interface SendMessageResult {
  conversationId: string;
  /// True when the turn ended on a proposed write action still waiting for
  /// the user to confirm or decline (see confirmToolCall/declineToolCall).
  pendingConfirmation: boolean;
}

export async function sendMessage(
  schoolId: string,
  userId: string,
  perms: Set<string>,
  conversationId: string,
  text: string
): Promise<SendMessageResult> {
  const provider = getAiProvider();
  if (!provider) throw new Error("No AI provider is configured.");

  const conversation = await prisma.aiConversation.findFirst({ where: { schoolId, userId, id: conversationId } });
  if (!conversation) throw new Error("Conversation not found.");

  await prisma.aiMessage.create({ data: { conversationId, role: "USER", content: text } });
  if (conversation.title === "New conversation") {
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { title: text.slice(0, 60) } });
  }

  const toolDefs = getToolsForPermissions(perms).map((t) => t.definition);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const history = await prisma.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
    const result = await provider.generate({ systemPrompt: SYSTEM_PROMPT, messages: rowsToChatMessages(history), tools: toolDefs });

    if (result.type === "text") {
      await prisma.aiMessage.create({ data: { conversationId, role: "ASSISTANT", content: result.text } });
      await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return { conversationId, pendingConfirmation: false };
    }

    let proposedWrite = false;
    for (const call of result.calls) {
      const tool = getToolByName(call.name);
      const isPermittedWrite = tool?.kind === "write" && perms.has(tool.permission);

      if (isPermittedWrite) {
        await prisma.aiMessage.create({
          data: {
            conversationId,
            role: "TOOL",
            toolName: call.name,
            toolArgs: call.arguments as unknown as Prisma.InputJsonValue,
            toolStatus: "PROPOSED",
          },
        });
        proposedWrite = true;
        continue;
      }

      const outcome =
        tool && perms.has(tool.permission)
          ? await runReadTool(schoolId, userId, call)
          : { result: null, error: "You don't have permission to use this tool." };

      await prisma.aiMessage.create({
        data: {
          conversationId,
          role: "TOOL",
          toolName: call.name,
          toolArgs: call.arguments as unknown as Prisma.InputJsonValue,
          toolResult: (outcome.error ? { error: outcome.error } : outcome.result) as unknown as Prisma.InputJsonValue,
          toolStatus: "EXECUTED",
        },
      });
    }

    if (proposedWrite) {
      await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return { conversationId, pendingConfirmation: true };
    }
    // Otherwise loop again — the provider will see this round's tool results in history.
  }

  await prisma.aiMessage.create({
    data: { conversationId, role: "ASSISTANT", content: "I wasn't able to finish that after a few tries — could you rephrase?" },
  });
  return { conversationId, pendingConfirmation: false };
}

export async function confirmToolCall(schoolId: string, userId: string, perms: Set<string>, aiMessageId: string) {
  const row = await prisma.aiMessage.findFirst({
    where: { id: aiMessageId, role: "TOOL", toolStatus: "PROPOSED", conversation: { schoolId, userId } },
  });
  if (!row) throw new Error("Nothing pending to confirm.");

  const tool = getToolByName(row.toolName ?? "");
  if (!tool || !perms.has(tool.permission)) throw new Error("You don't have permission to run this action.");

  try {
    const result = await tool.execute(schoolId, userId, (row.toolArgs as Record<string, unknown>) ?? {});
    await prisma.aiMessage.update({
      where: { id: row.id },
      data: { toolResult: result as unknown as Prisma.InputJsonValue, toolStatus: "EXECUTED" },
    });
    await logAudit({
      schoolId,
      userId,
      action: "ai.tool_call",
      resourceType: row.toolName ?? "unknown",
      newValue: { arguments: row.toolArgs, result } as unknown as Prisma.InputJsonValue,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    await prisma.aiMessage.update({
      where: { id: row.id },
      data: { toolResult: { error: message } as unknown as Prisma.InputJsonValue, toolStatus: "EXECUTED" },
    });
    throw error;
  }

  await generateFollowUp(schoolId, row.conversationId, perms);
}

export async function declineToolCall(schoolId: string, userId: string, perms: Set<string>, aiMessageId: string) {
  const row = await prisma.aiMessage.findFirst({
    where: { id: aiMessageId, role: "TOOL", toolStatus: "PROPOSED", conversation: { schoolId, userId } },
  });
  if (!row) throw new Error("Nothing pending to decline.");
  await prisma.aiMessage.update({ where: { id: row.id }, data: { toolStatus: "DECLINED" } });
  await generateFollowUp(schoolId, row.conversationId, perms);
}
