"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import {
  updatePreschoolReportComments,
  submitPreschoolReport,
  approvePreschoolReport,
  publishPreschoolReport,
  reopenPreschoolReport,
} from "@/lib/services/preschool-results";
import { generatePreschoolOverallComment } from "@/lib/services/preschool-ai";
import { logAudit } from "@/lib/audit";

export interface PreschoolReportState {
  status: "idle" | "error" | "success";
  message?: string;
}

const commentSchema = z.object({
  overallComment: z.string().trim().max(2000).optional().or(z.literal("")),
  teacherComment: z.string().trim().max(2000).optional().or(z.literal("")),
  principalComment: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updatePreschoolCommentsAction(
  studentId: string,
  termId: string,
  _prev: PreschoolReportState,
  formData: FormData
): Promise<PreschoolReportState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  const parsed = commentSchema.safeParse({
    overallComment: formData.get("overallComment") ?? "",
    teacherComment: formData.get("teacherComment") ?? "",
    principalComment: formData.get("principalComment") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Invalid comment." };

  const perms = await getUserPermissions(user.id);
  const canSetPrincipalComment = perms.has(PERMISSIONS.RESULTS_APPROVE);

  await updatePreschoolReportComments(user.schoolId, studentId, termId, {
    overallComment: parsed.data.overallComment || null,
    teacherComment: parsed.data.teacherComment || null,
    ...(canSetPrincipalComment ? { principalComment: parsed.data.principalComment || null } : {}),
  });
  revalidatePath(`/dashboard/results/preschool/reports/${studentId}`);
  return { status: "success", message: "Saved." };
}

export interface GenerateCommentState {
  status: "idle" | "error" | "success";
  comment?: string;
  message?: string;
}

export async function generatePreschoolCommentAction(
  studentId: string,
  termId: string,
  _prev: GenerateCommentState
): Promise<GenerateCommentState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  try {
    const comment = await generatePreschoolOverallComment(user.schoolId, studentId, termId);
    return { status: "success", comment };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate a comment." };
  }
}

export async function submitPreschoolReportAction(studentId: string, termId: string) {
  const user = await requirePermission(PERMISSIONS.RESULTS_ENTER);
  await submitPreschoolReport(user.schoolId, user.id, studentId, termId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_report.submitted", resourceType: "PreschoolReport", resourceId: `${studentId}:${termId}` });
  revalidatePath(`/dashboard/results/preschool/reports/${studentId}`);
  revalidatePath("/dashboard/results/preschool/reports");
}

export async function approvePreschoolReportAction(studentId: string, termId: string) {
  const user = await requirePermission(PERMISSIONS.RESULTS_APPROVE);
  await approvePreschoolReport(user.schoolId, user.id, studentId, termId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_report.approved", resourceType: "PreschoolReport", resourceId: `${studentId}:${termId}` });
  revalidatePath(`/dashboard/results/preschool/reports/${studentId}`);
  revalidatePath("/dashboard/results/preschool/reports");
}

export async function publishPreschoolReportAction(studentId: string, termId: string) {
  const user = await requirePermission(PERMISSIONS.RESULTS_PUBLISH);
  await publishPreschoolReport(user.schoolId, studentId, termId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_report.published", resourceType: "PreschoolReport", resourceId: `${studentId}:${termId}` });
  revalidatePath(`/dashboard/results/preschool/reports/${studentId}`);
  revalidatePath("/dashboard/results/preschool/reports");
}

export async function reopenPreschoolReportAction(studentId: string, termId: string) {
  const user = await requirePermission(PERMISSIONS.RESULTS_APPROVE);
  await reopenPreschoolReport(user.schoolId, studentId, termId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_report.reopened", resourceType: "PreschoolReport", resourceId: `${studentId}:${termId}` });
  revalidatePath(`/dashboard/results/preschool/reports/${studentId}`);
  revalidatePath("/dashboard/results/preschool/reports");
}
