"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { upsertAssessmentLevelLabel } from "@/lib/services/preschool-results";
import { updateClassGroupAssessmentMode } from "@/lib/services/scheme-of-work";
import { logAudit } from "@/lib/audit";
import type { ClassAssessmentMode, PreschoolAssessmentLevel } from "@/generated/prisma/client";

export interface PreschoolSettingsState {
  status: "idle" | "error" | "success";
  message?: string;
}

const CLASS_ASSESSMENT_MODES: ClassAssessmentMode[] = ["NUMERICAL", "MILESTONE", "BOTH"];
const ASSESSMENT_LEVELS: PreschoolAssessmentLevel[] = ["EXCEEDED", "ACHIEVED", "PROGRESSING", "DEVELOPING", "NEEDS_SUPPORT"];
const BADGE_VARIANTS = ["neutral", "accent", "secondary", "success", "warning", "danger"] as const;

const togglesSchema = z.object({
  preschoolResultsEnabled: z.boolean(),
  preschoolRequireTeacherComment: z.boolean(),
  preschoolRequireApprovalToPublish: z.boolean(),
  preschoolParentsCanView: z.boolean(),
  preschoolStudentsCanView: z.boolean(),
});

export async function updatePreschoolTogglesAction(
  _prev: PreschoolSettingsState,
  formData: FormData
): Promise<PreschoolSettingsState> {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);

  const parsed = togglesSchema.safeParse({
    preschoolResultsEnabled: formData.get("preschoolResultsEnabled") === "on",
    preschoolRequireTeacherComment: formData.get("preschoolRequireTeacherComment") === "on",
    preschoolRequireApprovalToPublish: formData.get("preschoolRequireApprovalToPublish") === "on",
    preschoolParentsCanView: formData.get("preschoolParentsCanView") === "on",
    preschoolStudentsCanView: formData.get("preschoolStudentsCanView") === "on",
  });
  if (!parsed.success) return { status: "error", message: "Invalid settings." };

  await prisma.school.update({ where: { id: user.schoolId }, data: parsed.data });
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "preschool_settings.updated", resourceType: "School", resourceId: user.schoolId });

  revalidatePath("/dashboard/results/preschool/settings");
  return { status: "success", message: "Saved." };
}

const levelLabelSchema = z.object({
  level: z.enum(ASSESSMENT_LEVELS as [PreschoolAssessmentLevel, ...PreschoolAssessmentLevel[]]),
  label: z.string().trim().min(1, "Label is required").max(60),
  colorVariant: z.enum(BADGE_VARIANTS),
});

export async function updateAssessmentLevelLabelAction(
  _prev: PreschoolSettingsState,
  formData: FormData
): Promise<PreschoolSettingsState> {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);

  const parsed = levelLabelSchema.safeParse({
    level: formData.get("level"),
    label: formData.get("label"),
    colorVariant: formData.get("colorVariant"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid label." };

  await upsertAssessmentLevelLabel(user.schoolId, parsed.data.level, { label: parsed.data.label, colorVariant: parsed.data.colorVariant });
  revalidatePath("/dashboard/results/preschool/settings");
  return { status: "success", message: "Saved." };
}

const classModeSchema = z.object({
  classGroupId: z.string().min(1),
  assessmentMode: z.enum(CLASS_ASSESSMENT_MODES as [ClassAssessmentMode, ...ClassAssessmentMode[]]),
});

export async function updateClassAssessmentModeAction(
  _prev: PreschoolSettingsState,
  formData: FormData
): Promise<PreschoolSettingsState> {
  const user = await requirePermission(PERMISSIONS.GRADING_MANAGE);

  const parsed = classModeSchema.safeParse({
    classGroupId: formData.get("classGroupId"),
    assessmentMode: formData.get("assessmentMode"),
  });
  if (!parsed.success) return { status: "error", message: "Invalid selection." };

  try {
    await updateClassGroupAssessmentMode(user.schoolId, parsed.data.classGroupId, parsed.data.assessmentMode);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update class." };
  }
  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "class_group.assessment_mode_updated",
    resourceType: "ClassGroup",
    resourceId: parsed.data.classGroupId,
  });

  revalidatePath("/dashboard/results/preschool/settings");
  return { status: "success", message: "Saved." };
}
