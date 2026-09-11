"use server";

import { requireSchoolUser } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { getSchoolHealthDashboard, SchoolHealthAccessDeniedError } from "@/lib/services/school-health/analysis";
import { generateSchoolHealthInsight, type SchoolHealthAiInsight } from "@/lib/services/school-health/ai-insight";
import { EntitlementError } from "@/lib/billing/entitlements";

export interface GenerateSchoolHealthInsightState {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
  insight?: SchoolHealthAiInsight;
}

/// Re-runs the same access check and re-fetches the same dashboard the
/// page itself already computed — never trusts a client-held copy of
/// metrics as still valid or still theirs to see (same "belt and
/// suspenders" pattern as every other server action in this app).
export async function generateSchoolHealthInsightAction(termId?: string): Promise<GenerateSchoolHealthInsightState> {
  const user = await requireSchoolUser();
  const perms = await getUserPermissions(user.id);

  try {
    const dashboard = await getSchoolHealthDashboard(user.schoolId, user.id, perms, termId);
    const insight = await generateSchoolHealthInsight(user.schoolId, user.id, dashboard);
    return { status: "success", insight };
  } catch (error) {
    if (error instanceof SchoolHealthAccessDeniedError) {
      return { status: "error", message: "You're not authorized to view the School Health Dashboard." };
    }
    if (error instanceof EntitlementError) {
      return { status: "error", message: "AI executive insights aren't included in this school's current plan." };
    }
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate an AI insight." };
  }
}
