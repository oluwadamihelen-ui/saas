"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { replyToConversation, closeConversation, reopenConversation } from "@/lib/services/messages";

const schema = z.object({ body: z.string().trim().min(1, "Message can't be empty").max(4000) });

export interface ReplyState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function replyAsStaffAction(conversationId: string, _prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const user = await requirePermission(PERMISSIONS.MESSAGES_MANAGE);

  const parsed = schema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a message." };
  }

  await replyToConversation(user.schoolId, user.id, conversationId, parsed.data.body);
  revalidatePath(`/dashboard/messages/${conversationId}`);
  revalidatePath("/dashboard/messages");
  return { status: "success" };
}

export async function closeConversationAction(conversationId: string) {
  const user = await requirePermission(PERMISSIONS.MESSAGES_MANAGE);
  await closeConversation(user.schoolId, conversationId);
  revalidatePath(`/dashboard/messages/${conversationId}`);
  revalidatePath("/dashboard/messages");
}

export async function reopenConversationAction(conversationId: string) {
  const user = await requirePermission(PERMISSIONS.MESSAGES_MANAGE);
  await reopenConversation(user.schoolId, conversationId);
  revalidatePath(`/dashboard/messages/${conversationId}`);
  revalidatePath("/dashboard/messages");
}
