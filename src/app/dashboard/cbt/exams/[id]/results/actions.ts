"use server";

import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { generateExamInsights } from "@/lib/services/cbt-ai";

export interface GenerateInsightsResult {
  status: "ok" | "error";
  insights?: string;
  message?: string;
}

export async function generateExamInsightsAction(examId: string): Promise<GenerateInsightsResult> {
  const user = await requirePermission(PERMISSIONS.CBT_VIEW_RESULTS);
  try {
    const insights = await generateExamInsights(user.schoolId, examId);
    return { status: "ok", insights };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate insights." };
  }
}
