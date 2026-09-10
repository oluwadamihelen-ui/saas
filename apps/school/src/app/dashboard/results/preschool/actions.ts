"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAnyPermission, requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { saveMilestoneAssessments, createAssessmentPeriod } from "@/lib/services/preschool-results";
import {
  assertClassSubjectAccess,
  getOrCreateSchemeOfWork,
  addTopic,
  updateTopic,
  deleteTopic,
  addMilestone,
  updateMilestone,
  archiveMilestone,
  restoreMilestone,
} from "@/lib/services/scheme-of-work";
import { logAudit } from "@/lib/audit";
import type { PreschoolAssessmentLevel, PreschoolAssessmentPeriodType } from "@/generated/prisma/client";

const LEVELS = new Set<PreschoolAssessmentLevel>(["EXCEEDED", "ACHIEVED", "PROGRESSING", "DEVELOPING", "NEEDS_SUPPORT"]);

export interface MilestoneGridState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function saveMilestoneGridAction(
  classArmId: string,
  subjectId: string,
  termId: string,
  assessmentPeriodId: string,
  _prev: MilestoneGridState,
  formData: FormData
): Promise<MilestoneGridState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  await assertClassSubjectAccess(user.schoolId, user, classArmId, subjectId);

  const perms = await getUserPermissions(user.id);
  const canOverrideLock = perms.has(PERMISSIONS.RESULTS_APPROVE);

  const entries: { studentId: string; milestoneId: string; level: PreschoolAssessmentLevel; comment?: string | null }[] = [];
  const commentByKey = new Map<string, string>();
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("comment__") && typeof raw === "string") {
      commentByKey.set(key.replace("comment__", ""), raw);
    }
  }
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("level__") || typeof raw !== "string" || !raw) continue;
    if (!LEVELS.has(raw as PreschoolAssessmentLevel)) continue;
    const rest = key.replace("level__", "");
    const [studentId, milestoneId] = rest.split("__");
    entries.push({ studentId, milestoneId, level: raw as PreschoolAssessmentLevel, comment: commentByKey.get(rest) || null });
  }

  if (entries.length === 0) {
    return { status: "error", message: "Assess at least one student against one milestone." };
  }

  try {
    await saveMilestoneAssessments(user.schoolId, user.id, canOverrideLock, { subjectId, termId, assessmentPeriodId, entries });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save assessments." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "preschool_milestones.assessed",
    resourceType: "PreschoolMilestoneAssessment",
    resourceId: `${classArmId}:${subjectId}:${termId}:${assessmentPeriodId}`,
    newValue: { count: entries.length },
  });

  revalidatePath("/dashboard/results/preschool");
  return { status: "success", message: `Saved ${entries.length} assessment${entries.length === 1 ? "" : "s"}.` };
}

const periodSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.enum(["CONTINUOUS_ASSESSMENT", "TEST", "EXAMINATION", "MID_TERM", "END_OF_TERM", "OBSERVATION", "WEEKLY", "CUSTOM"]),
});

export async function createAssessmentPeriodAction(termId: string, _prev: MilestoneGridState, formData: FormData): Promise<MilestoneGridState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  const parsed = periodSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid assessment period." };

  try {
    await createAssessmentPeriod(user.schoolId, termId, parsed.data as { name: string; type: PreschoolAssessmentPeriodType });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create assessment period." };
  }

  revalidatePath("/dashboard/results/preschool");
  return { status: "success" };
}

// ---------------------------------------------------------------------
// Scheme of Work management
// ---------------------------------------------------------------------

export async function ensureSchemeOfWorkAction(input: { academicSessionId: string; termId: string; classGroupId: string; subjectId: string }) {
  const user = await requireAnyPermission([PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE, PERMISSIONS.RESULTS_ENTER]);
  return getOrCreateSchemeOfWork(user.schoolId, user.id, input);
}

const topicSchema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(52),
  title: z.string().trim().min(1, "Topic title is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export interface SchemeOfWorkState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function addTopicAction(schemeOfWorkId: string, _prev: SchemeOfWorkState, formData: FormData): Promise<SchemeOfWorkState> {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  const parsed = topicSchema.safeParse({
    weekNumber: formData.get("weekNumber"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid topic." };

  try {
    await addTopic(user.schoolId, schemeOfWorkId, { weekNumber: parsed.data.weekNumber, title: parsed.data.title, description: parsed.data.description || null });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add topic." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "scheme_of_work_topic.created", resourceType: "SchemeOfWorkTopic", resourceId: schemeOfWorkId });
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
  return { status: "success", message: "Topic added." };
}

export async function updateTopicAction(topicId: string, _prev: SchemeOfWorkState, formData: FormData): Promise<SchemeOfWorkState> {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  const parsed = topicSchema.partial({ weekNumber: true, title: true }).safeParse({
    weekNumber: formData.get("weekNumber") || undefined,
    title: formData.get("title") || undefined,
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Invalid topic." };

  try {
    await updateTopic(user.schoolId, topicId, { weekNumber: parsed.data.weekNumber, title: parsed.data.title, description: parsed.data.description || null });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update topic." };
  }
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
  return { status: "success" };
}

export async function deleteTopicAction(topicId: string) {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  await deleteTopic(user.schoolId, topicId);
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
}

const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Milestone title is required").max(200),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function addMilestoneAction(topicId: string, _prev: SchemeOfWorkState, formData: FormData): Promise<SchemeOfWorkState> {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  const parsed = milestoneSchema.safeParse({ title: formData.get("title"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid milestone." };

  try {
    await addMilestone(user.schoolId, user.id, topicId, { title: parsed.data.title, description: parsed.data.description || null });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add milestone." };
  }

  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_milestone.created", resourceType: "PreschoolMilestone", resourceId: topicId });
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
  return { status: "success", message: "Milestone added." };
}

export async function updateMilestoneAction(milestoneId: string, _prev: SchemeOfWorkState, formData: FormData): Promise<SchemeOfWorkState> {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  const parsed = milestoneSchema.partial({ title: true }).safeParse({ title: formData.get("title") || undefined, description: formData.get("description") ?? "" });
  if (!parsed.success) return { status: "error", message: "Invalid milestone." };

  try {
    await updateMilestone(user.schoolId, milestoneId, { title: parsed.data.title, description: parsed.data.description || null });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update milestone." };
  }
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
  return { status: "success" };
}

export async function archiveMilestoneAction(milestoneId: string) {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  await archiveMilestone(user.schoolId, milestoneId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_milestone.archived", resourceType: "PreschoolMilestone", resourceId: milestoneId });
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
}

export async function restoreMilestoneAction(milestoneId: string) {
  const user = await requirePermission(PERMISSIONS.PRESCHOOL_MILESTONES_MANAGE);
  await restoreMilestone(user.schoolId, milestoneId);
  revalidatePath("/dashboard/results/preschool/scheme-of-work");
}
