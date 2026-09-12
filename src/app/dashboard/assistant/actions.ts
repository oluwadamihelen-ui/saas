"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createAiConversation,
  sendMessage,
  confirmToolCall,
  declineToolCall,
} from "@/lib/services/ai-assistant";

export async function startAiConversationAction() {
  const user = await requirePermission(PERMISSIONS.ASSISTANT_USE);
  const conversation = await createAiConversation(user.schoolId, user.id);
  redirect(`/dashboard/assistant/${conversation.id}`);
}

const messageSchema = z.object({ text: z.string().trim().min(1, "Type a message first.").max(2000) });

export interface AssistantMessageState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function sendAiMessageAction(
  conversationId: string,
  _prev: AssistantMessageState,
  formData: FormData
): Promise<AssistantMessageState> {
  const user = await requirePermission(PERMISSIONS.ASSISTANT_USE);

  const parsed = messageSchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Type a message first." };
  }

  const perms = await getUserPermissions(user.id);

  try {
    await sendMessage(user.schoolId, user.id, perms, conversationId, parsed.data.text);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Something went wrong." };
  }

  revalidatePath(`/dashboard/assistant/${conversationId}`);
  revalidatePath("/dashboard/assistant");
  return { status: "success" };
}

export async function confirmAiToolCallAction(conversationId: string, aiMessageId: string) {
  const user = await requirePermission(PERMISSIONS.ASSISTANT_USE);
  const perms = await getUserPermissions(user.id);
  await confirmToolCall(user.schoolId, user.id, perms, aiMessageId);
  revalidatePath(`/dashboard/assistant/${conversationId}`);
}

export async function declineAiToolCallAction(conversationId: string, aiMessageId: string) {
  const user = await requirePermission(PERMISSIONS.ASSISTANT_USE);
  const perms = await getUserPermissions(user.id);
  await declineToolCall(user.schoolId, user.id, perms, aiMessageId);
  revalidatePath(`/dashboard/assistant/${conversationId}`);
}
