"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { scheduleLiveClass, updateLiveClass, cancelLiveClass, startLiveClass, endLiveClass, type LiveClassInput } from "@/lib/services/live-classes";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { LiveClassFormState } from "./live-class-form";

const liveClassSchema = z.object({
  subjectClassKey: z.string().trim().min(1, "Select a subject and class"),
  termId: z.string().trim().min(1, "Select a term"),
  title: z.string().trim().min(1, "Title is required").max(200),
  topic: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  scheduledDate: z.string().trim().min(1, "Select a date"),
  scheduledTime: z.string().trim().min(1, "Select a start time"),
  durationMinutes: z.coerce.number().int().min(5).max(300),
  maxParticipants: z.coerce.number().int().min(1).optional().or(z.literal("")),
  joinWindowMinutesBefore: z.coerce.number().int().min(0).max(120).optional(),
});

async function buildLiveClassInput(schoolId: string, formData: FormData): Promise<{ input?: LiveClassInput; error?: string }> {
  const parsed = liveClassSchema.safeParse({
    subjectClassKey: formData.get("subjectClassKey"),
    termId: formData.get("termId"),
    title: formData.get("title"),
    topic: formData.get("topic") ?? "",
    description: formData.get("description") ?? "",
    scheduledDate: formData.get("scheduledDate"),
    scheduledTime: formData.get("scheduledTime"),
    durationMinutes: formData.get("durationMinutes"),
    maxParticipants: formData.get("maxParticipants") || "",
    joinWindowMinutesBefore: formData.get("joinWindowMinutesBefore") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the class details." };
  }

  const [subjectId, classArmId] = parsed.data.subjectClassKey.split("|");
  if (!subjectId || !classArmId) return { error: "Select a subject and class." };

  const term = await prisma.term.findFirst({ where: { schoolId, id: parsed.data.termId } });
  if (!term) return { error: "Select a valid term." };

  const scheduledStart = new Date(`${parsed.data.scheduledDate}T${parsed.data.scheduledTime}:00`);
  if (Number.isNaN(scheduledStart.getTime())) return { error: "Enter a valid date and time." };

  return {
    input: {
      subjectId,
      classArmId,
      academicSessionId: term.academicSessionId,
      termId: term.id,
      title: parsed.data.title,
      topic: parsed.data.topic || null,
      description: parsed.data.description || null,
      scheduledStart,
      durationMinutes: parsed.data.durationMinutes,
      maxParticipants: parsed.data.maxParticipants ? Number(parsed.data.maxParticipants) : null,
      joinWindowMinutesBefore: parsed.data.joinWindowMinutesBefore,
    },
  };
}

export async function scheduleLiveClassAction(_prev: LiveClassFormState, formData: FormData): Promise<LiveClassFormState> {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE);
  const { input, error } = await buildLiveClassInput(user.schoolId, formData);
  if (error || !input) return { status: "error", message: error ?? "Please check the class details." };

  let liveClass;
  try {
    liveClass = await scheduleLiveClass(user.schoolId, user.id, input);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Could not schedule this class." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "live_class.scheduled", resourceType: "LiveClass", resourceId: liveClass.id, newValue: { title: liveClass.title } });
  revalidatePath("/dashboard/online-learning/live-classes");
  redirect(`/dashboard/online-learning/live-classes/${liveClass.id}`);
}

export async function updateLiveClassAction(liveClassId: string, _prev: LiveClassFormState, formData: FormData): Promise<LiveClassFormState> {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE);
  const { input, error } = await buildLiveClassInput(user.schoolId, formData);
  if (error || !input) return { status: "error", message: error ?? "Please check the class details." };

  try {
    await updateLiveClass(user.schoolId, user.id, liveClassId, input);
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Could not update this class." };
  }

  revalidatePath("/dashboard/online-learning/live-classes");
  revalidatePath(`/dashboard/online-learning/live-classes/${liveClassId}`);
  redirect(`/dashboard/online-learning/live-classes/${liveClassId}`);
}

export async function cancelLiveClassAction(liveClassId: string) {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_MANAGE);
  await cancelLiveClass(user.schoolId, user.id, liveClassId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "live_class.cancelled", resourceType: "LiveClass", resourceId: liveClassId });
  revalidatePath("/dashboard/online-learning/live-classes");
  revalidatePath(`/dashboard/online-learning/live-classes/${liveClassId}`);
}

export async function startLiveClassAction(liveClassId: string) {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_START);
  try {
    await startLiveClass(user.schoolId, user.id, liveClassId);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "Could not start this class.");
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "live_class.started", resourceType: "LiveClass", resourceId: liveClassId });
  revalidatePath("/dashboard/online-learning/live-classes");
  redirect(`/classroom/${liveClassId}`);
}

export async function endLiveClassAction(liveClassId: string) {
  const user = await requirePermission(PERMISSIONS.LIVE_CLASSES_START);
  await endLiveClass(user.schoolId, user.id, liveClassId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "live_class.ended", resourceType: "LiveClass", resourceId: liveClassId });
  revalidatePath("/dashboard/online-learning/live-classes");
  redirect(`/dashboard/online-learning/live-classes/${liveClassId}/attendance`);
}
