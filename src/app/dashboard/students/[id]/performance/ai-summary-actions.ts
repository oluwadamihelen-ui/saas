"use server";

import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { getStudentPerformanceAnalysis } from "@/lib/services/performance/analysis";
import { generatePerformanceSummary, type PerformanceAiSummary } from "@/lib/services/performance/ai-summary";
import { EntitlementError } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/db";

export interface GenerateAiSummaryState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  summary?: PerformanceAiSummary;
}

/// Re-runs the same permission + teacher-class-scoping check the page
/// itself already passed — never trusts that a client that could see the
/// page is still entitled to act, the same "belt and suspenders" pattern
/// every other server action in this app follows.
export async function generateAiSummaryAction(studentId: string, termId?: string): Promise<GenerateAiSummaryState> {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW);
  const perms = await getUserPermissions(user.id);

  try {
    const analysis = await getStudentPerformanceAnalysis(user.schoolId, user.id, perms, studentId, termId);
    const student = await prisma.student.findFirst({ where: { schoolId: user.schoolId, id: studentId }, select: { firstName: true } });
    if (!student) return { status: "error", message: "Student not found." };

    const summary = await generatePerformanceSummary(user.schoolId, user.id, studentId, student.firstName, analysis);
    return { status: "success", summary };
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { status: "error", message: "AI performance insights aren't included in this school's current plan." };
    }
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate an AI summary." };
  }
}
