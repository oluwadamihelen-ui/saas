"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import { startConversation, replyToConversation } from "@/lib/services/messages";

const startSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Message can't be empty").max(4000),
  studentId: z.string().trim().optional().or(z.literal("")),
});

export interface MessageFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function startConversationAction(_prev: MessageFormState, formData: FormData): Promise<MessageFormState> {
  const user = await requireSchoolUser();

  const parsed = startSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    studentId: formData.get("studentId") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const conversation = await startConversation(user.schoolId, user.id, {
    subject: parsed.data.subject,
    body: parsed.data.body,
    studentId: parsed.data.studentId || null,
  });

  revalidatePath("/portal/parent/messages");
  redirect(`/portal/parent/messages/${conversation.id}`);
}

const replySchema = z.object({ body: z.string().trim().min(1, "Message can't be empty").max(4000) });

export async function replyAsParentAction(conversationId: string, _prev: MessageFormState, formData: FormData): Promise<MessageFormState> {
  const user = await requireSchoolUser();

  const parsed = replySchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a message." };
  }

  await replyToConversation(user.schoolId, user.id, conversationId, parsed.data.body);
  revalidatePath(`/portal/parent/messages/${conversationId}`);
  return { status: "success" };
}
