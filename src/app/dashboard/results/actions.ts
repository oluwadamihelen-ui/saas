"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import {
  saveScores,
  createGradeBand,
  deleteGradeBand,
  createAssessmentComponent,
  deleteAssessmentComponent,
  updateReportCardComments,
  approveReportCard,
  publishReportCard,
} from "@/lib/services/results";
import { logAudit } from "@/lib/audit";

export interface ScoreGridState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function saveScoreGridAction(
  classArmId: string,
  subjectId: string,
  termId: string,
  _prev: ScoreGridState,
  formData: FormData
): Promise<ScoreGridState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);

  const entries: { studentId: string; componentId: string; value: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("score__")) continue;
    const value = raw === "" ? null : Number(raw);
    if (value === null || Number.isNaN(value)) continue;
    const [, studentId, componentId] = key.split("__");
    entries.push({ studentId, componentId, value });
  }

  if (entries.length === 0) {
    return { status: "error", message: "Enter at least one score." };
  }

  try {
    await saveScores(user.schoolId, user.id, { subjectId, termId, classArmId, entries });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save scores." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "scores.saved",
    resourceType: "Score",
    resourceId: `${classArmId}:${subjectId}:${termId}`,
    newValue: { count: entries.length },
  });

  revalidatePath("/dashboard/results");
  return { status: "success", message: `Saved ${entries.length} score${entries.length === 1 ? "" : "s"}.` };
}

const gradeBandSchema = z.object({
  grade: z.string().trim().min(1).max(10),
  minScore: z.coerce.number().int().min(0).max(100),
  maxScore: z.coerce.number().int().min(0).max(100),
  remark: z.string().trim().min(1).max(50),
});

export interface GradingConfigState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function createGradeBandAction(_prev: GradingConfigState, formData: FormData): Promise<GradingConfigState> {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);
  const parsed = gradeBandSchema.safeParse({
    grade: formData.get("grade"),
    minScore: formData.get("minScore"),
    maxScore: formData.get("maxScore"),
    remark: formData.get("remark"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid grade band." };

  await createGradeBand(user.schoolId, parsed.data);
  revalidatePath("/dashboard/results/grading");
  return { status: "success" };
}

export async function deleteGradeBandAction(id: string) {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);
  await deleteGradeBand(user.schoolId, id);
  revalidatePath("/dashboard/results/grading");
}

const componentSchema = z.object({
  name: z.string().trim().min(1).max(50),
  maxScore: z.coerce.number().int().min(1).max(1000),
});

export async function createComponentAction(_prev: GradingConfigState, formData: FormData): Promise<GradingConfigState> {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);
  const parsed = componentSchema.safeParse({ name: formData.get("name"), maxScore: formData.get("maxScore") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid component." };

  await createAssessmentComponent(user.schoolId, parsed.data);
  revalidatePath("/dashboard/results/grading");
  return { status: "success" };
}

export async function deleteComponentAction(id: string) {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);
  await deleteAssessmentComponent(user.schoolId, id);
  revalidatePath("/dashboard/results/grading");
}

const commentSchema = z.object({
  teacherComment: z.string().trim().max(2000).optional().or(z.literal("")),
  principalComment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateCommentsAction(
  studentId: string,
  termId: string,
  _prev: GradingConfigState,
  formData: FormData
): Promise<GradingConfigState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  const parsed = commentSchema.safeParse({
    teacherComment: formData.get("teacherComment") ?? "",
    principalComment: formData.get("principalComment") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Invalid comment." };

  // The principal's comment field is only ever rendered for users who can
  // approve results — but the permission check has to happen here too, not
  // just in the UI, since a forged form field would otherwise bypass it.
  const perms = await getUserPermissions(user.id);
  const canSetPrincipalComment = perms.has(PERMISSIONS.RESULTS_APPROVE);

  await updateReportCardComments(user.schoolId, studentId, termId, {
    teacherComment: parsed.data.teacherComment || null,
    ...(canSetPrincipalComment ? { principalComment: parsed.data.principalComment || null } : {}),
  });
  revalidatePath(`/dashboard/results/report-cards/${studentId}`);
  return { status: "success", message: "Saved." };
}

export async function approveReportCardAction(studentId: string, termId: string) {
  const user = await requirePermission(PERMISSIONS.RESULTS_APPROVE);
  await approveReportCard(user.schoolId, user.id, studentId, termId);
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "report_card.approved",
    resourceType: "ReportCard",
    resourceId: `${studentId}:${termId}`,
  });
  revalidatePath(`/dashboard/results/report-cards/${studentId}`);
  revalidatePath("/dashboard/results/report-cards");
}

export async function publishReportCardAction(studentId: string, termId: string) {
  const user = await requirePermission(PERMISSIONS.RESULTS_PUBLISH);
  await publishReportCard(user.schoolId, studentId, termId);
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "report_card.published",
    resourceType: "ReportCard",
    resourceId: `${studentId}:${termId}`,
  });
  revalidatePath(`/dashboard/results/report-cards/${studentId}`);
  revalidatePath("/dashboard/results/report-cards");
}
