"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, withAuthErrors } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toMinorUnits } from "@/lib/money";
import { thresholdsSchema } from "./thresholds-schema";

export interface ThresholdsState {
  status: "idle" | "error" | "success";
  message?: string;
}

/// All nine fields already had sensible defaults on School (see the
/// schema doc comments) and were fully wired into risk-engine.ts,
/// health-score.ts and expenses.ts before this UI existed — this action
/// is purely the first way to edit them without a direct DB write.
export const saveThresholdsAction = withAuthErrors(async function saveThresholdsAction(_prev: ThresholdsState, formData: FormData): Promise<ThresholdsState> {
  const user = await requirePermission(PERMISSIONS.SCHOOL_SETTINGS_MANAGE);

  const parsed = thresholdsSchema.safeParse({
    expenseApprovalThreshold: formData.get("expenseApprovalThreshold"),
    performancePassMark: formData.get("performancePassMark"),
    performanceSignificantChangePoints: formData.get("performanceSignificantChangePoints"),
    attendanceConcernThreshold: formData.get("attendanceConcernThreshold"),
    performanceFailedSubjectConcernThreshold: formData.get("performanceFailedSubjectConcernThreshold"),
    healthScoreWeightAcademic: formData.get("healthScoreWeightAcademic"),
    healthScoreWeightAttendance: formData.get("healthScoreWeightAttendance"),
    healthScoreWeightFinancial: formData.get("healthScoreWeightFinancial"),
    healthScoreWeightOperational: formData.get("healthScoreWeightOperational"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check your entries." };
  }

  const before = await prisma.school.findUniqueOrThrow({
    where: { id: user.schoolId },
    select: {
      expenseApprovalThresholdMinor: true,
      performancePassMark: true,
      performanceSignificantChangePoints: true,
      attendanceConcernThreshold: true,
      performanceFailedSubjectConcernThreshold: true,
      healthScoreWeightAcademic: true,
      healthScoreWeightAttendance: true,
      healthScoreWeightFinancial: true,
      healthScoreWeightOperational: true,
    },
  });

  const after = {
    expenseApprovalThresholdMinor: toMinorUnits(parsed.data.expenseApprovalThreshold),
    performancePassMark: parsed.data.performancePassMark,
    performanceSignificantChangePoints: parsed.data.performanceSignificantChangePoints,
    attendanceConcernThreshold: parsed.data.attendanceConcernThreshold,
    performanceFailedSubjectConcernThreshold: parsed.data.performanceFailedSubjectConcernThreshold,
    healthScoreWeightAcademic: parsed.data.healthScoreWeightAcademic,
    healthScoreWeightAttendance: parsed.data.healthScoreWeightAttendance,
    healthScoreWeightFinancial: parsed.data.healthScoreWeightFinancial,
    healthScoreWeightOperational: parsed.data.healthScoreWeightOperational,
  };

  await prisma.school.update({ where: { id: user.schoolId }, data: after });

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "school.thresholds_changed",
    resourceType: "School",
    resourceId: user.schoolId,
    previousValue: before,
    newValue: after,
  });

  revalidatePath("/dashboard/settings");
  return { status: "success", message: "Saved." };
});
