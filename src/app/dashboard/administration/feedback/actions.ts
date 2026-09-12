"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSchoolUser } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { submitFeedback, markFeedbackReviewed } from "@/lib/services/feedback";
import { notifyNewFeedback } from "@/lib/services/notifications";

export interface FeedbackFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const submitSchema = z.object({ message: z.string().trim().min(1, "Enter your feedback").max(2000) });

/// Submitting isn't an administrative action — any signed-in user (staff or
/// a parent/student portal account) can do it, so this only requires
/// requireSchoolUser(), not a feedback.* permission. Shared by the
/// dashboard, parent portal and student portal submission forms.
export async function submitFeedbackAction(_prev: FeedbackFormState, formData: FormData): Promise<FeedbackFormState> {
  const user = await requireSchoolUser();
  const parsed = submitSchema.safeParse({ message: formData.get("message") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your details." };

  const feedback = await submitFeedback(user.schoolId, user.id, parsed.data.message);
  await notifyNewFeedback(user.schoolId, feedback.id, user.id);
  revalidatePath("/dashboard/administration/feedback");
  revalidatePath("/portal/parent/feedback");
  revalidatePath("/portal/student/feedback");
  return { status: "success", message: "Thanks — your feedback has been submitted." };
}

export async function markFeedbackReviewedAction(id: string) {
  const admin = await requirePermission(PERMISSIONS.FEEDBACK_MANAGE);
  await markFeedbackReviewed(admin.schoolId, id, admin.id);
  revalidatePath("/dashboard/administration/feedback");
}
