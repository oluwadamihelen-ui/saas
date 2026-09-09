"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { gradeAnswer } from "@/lib/services/cbt-grading";
import { suggestGrade, type GradingSuggestion } from "@/lib/services/cbt-ai";
import { logAudit } from "@/lib/audit";

const gradeSchema = z.object({
  marksAwarded: z.coerce.number().min(0),
  feedback: z.string().trim().max(2000).optional().or(z.literal("")),
  aiSuggestedMarks: z.coerce.number().optional(),
  aiSuggestedFeedback: z.string().trim().max(2000).optional().or(z.literal("")),
});

export interface GradeAnswerState {
  status: "idle" | "error";
  message?: string;
}

export async function gradeAnswerAction(
  answerId: string,
  _prev: GradeAnswerState,
  formData: FormData
): Promise<GradeAnswerState> {
  const user = await requirePermission(PERMISSIONS.CBT_GRADE);

  const parsed = gradeSchema.safeParse({
    marksAwarded: formData.get("marksAwarded"),
    feedback: formData.get("feedback") ?? "",
    aiSuggestedMarks: formData.get("aiSuggestedMarks") || undefined,
    aiSuggestedFeedback: formData.get("aiSuggestedFeedback") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the marks entered." };
  }

  try {
    await gradeAnswer(
      user.schoolId,
      user.id,
      answerId,
      parsed.data.marksAwarded,
      parsed.data.feedback || null,
      parsed.data.aiSuggestedMarks,
      parsed.data.aiSuggestedFeedback || null
    );
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save the grade." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_answer.graded", resourceType: "CBTAnswer", resourceId: answerId });
  revalidatePath("/dashboard/cbt/grading");
  redirect("/dashboard/cbt/grading");
}

export interface GetGradingSuggestionResult {
  status: "ok" | "error";
  suggestion?: GradingSuggestion;
  message?: string;
}

export async function getGradingSuggestionAction(answerId: string): Promise<GetGradingSuggestionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_GRADE);
  try {
    const suggestion = await suggestGrade(user.schoolId, answerId);
    return { status: "ok", suggestion };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not get a suggestion." };
  }
}
