"use server";

import { revalidatePath } from "next/cache";
import { requireSchoolUser } from "@/lib/auth/require";
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearExpiredNotifications,
  setNotificationPreference,
} from "@/lib/services/notifications";
import type { NotificationCategory } from "@/generated/prisma/client";
import { generateNotificationsAiSummary, isNotificationAiConfigured, type NotificationsAiSummary } from "@/lib/services/notification-ai-summary";

export async function markNotificationReadAction(id: string) {
  const user = await requireSchoolUser();
  await markNotificationRead(user.schoolId, user.id, id);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

export async function markAllNotificationsReadAction() {
  const user = await requireSchoolUser();
  await markAllNotificationsRead(user.schoolId, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

export async function deleteNotificationAction(id: string) {
  const user = await requireSchoolUser();
  await deleteNotification(user.schoolId, user.id, id);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

export async function clearExpiredNotificationsAction() {
  const user = await requireSchoolUser();
  await clearExpiredNotifications(user.schoolId, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

export async function setNotificationPreferenceAction(category: NotificationCategory, inAppEnabled: boolean) {
  const user = await requireSchoolUser();
  await setNotificationPreference(user.schoolId, user.id, category, inAppEnabled);
  revalidatePath("/dashboard/notifications/preferences");
  revalidatePath("/portal/parent/notifications/preferences");
  revalidatePath("/portal/student/notifications/preferences");
}

export interface NotificationsAiSummaryResult {
  ok: boolean;
  summary?: NotificationsAiSummary | null;
  error?: string;
}

/// Never throws to the client — every failure mode (AI not configured,
/// feature not entitled, provider error) becomes a plain result the UI can
/// render a friendly fallback for, per brief section 37: "the system
/// should remain fully functional even when AI API keys are unavailable."
export async function generateNotificationsAiSummaryAction(): Promise<NotificationsAiSummaryResult> {
  const user = await requireSchoolUser();
  if (!isNotificationAiConfigured()) return { ok: false, error: "AI summaries aren't configured for this deployment." };
  try {
    const summary = await generateNotificationsAiSummary(user.schoolId, user.id);
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't generate a summary right now." };
  }
}
