import "server-only";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { requireFeature } from "@/lib/billing/entitlements";
import { logAudit } from "@/lib/audit";
import type { SchoolHealthDashboard } from "./types";

export function isSchoolHealthAiConfigured(): boolean {
  return getAiProvider() !== null;
}

// ---------------------------------------------------------------------
// AI Executive Insight — an optional narrative layer over the
// deterministic School Health engine's own output, modeled byte-for-byte
// on performance/ai-summary.ts's generatePerformanceSummary(): one-shot,
// fed only already-computed aggregate metrics (never a student name, no
// dates of birth, no parent/guardian contact info, no raw financial
// records), strict JSON response, validated before use. The model never
// computes the Health Score, a risk level, or a money figure — every
// number it can reference is already in the prompt.
// ---------------------------------------------------------------------

const SYSTEM_PROMPT = `You write a short executive summary for a school's leadership (owner/administrator/principal), \
using ONLY the structured aggregate metrics you are given — never invent a number, score, or trend not in the input, \
and never calculate the School Health Score, a risk level, or any financial figure yourself. \
Respond with ONLY a JSON object of the shape {"summary": string, "strengths": string[], "concerns": string[], \
"suggestedActions": string[]} — no prose outside the JSON, no markdown fences. \
"summary" is 2-4 plain sentences covering overall school health across academics, attendance, finance and \
operations, using only the figures given. "strengths" is 0-4 short bullet points of genuine positives from the \
data — omit entirely if there are none. "concerns" is 0-4 short bullet points naming specific data-backed concerns \
— omit entirely if there are none. "suggestedActions" is 2-4 short, generic, non-disciplinary suggestions (e.g. \
"Review Mathematics performance in the lowest-scoring class", "Follow up on outstanding fee balances", "Confirm \
attendance is being recorded consistently across all classes") — optional ideas for staff to consider, never \
instructions. Never mention any individual student, parent, or staff member by name — you were not given any. \
Never diagnose or suggest a medical, psychological, learning, or behavioural condition. Keep language constructive \
and professional, appropriate for a school leadership audience.`;

export interface SchoolHealthAiInsight {
  summary: string;
  strengths: string[];
  concerns: string[];
  suggestedActions: string[];
}

function parseJsonResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch {
    throw new Error("The AI response wasn't valid JSON. Try again.");
  }
}

function validateInsight(value: unknown): SchoolHealthAiInsight {
  if (!value || typeof value !== "object") throw new Error("Unexpected AI response shape.");
  const v = value as Record<string, unknown>;
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  if (!summary) throw new Error("The AI response was missing a summary.");
  const asStringArray = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 4) : [];
  return {
    summary,
    strengths: asStringArray(v.strengths),
    concerns: asStringArray(v.concerns),
    suggestedActions: asStringArray(v.suggestedActions),
  };
}

/// Minimal, aggregate-only payload — every figure already verified by
/// the deterministic engine, no PII of any kind (brief: "prefer sending
/// aggregated data ... Poor: sending every student's full name, email,
/// date of birth").
function buildPromptPayload(dashboard: SchoolHealthDashboard) {
  return {
    period: dashboard.period ? `${dashboard.period.academicSessionName} ${dashboard.period.termName}` : null,
    healthScore: dashboard.healthScore.overallScore,
    healthLevel: dashboard.healthScore.overallLevel,
    healthCompleteness: dashboard.healthScore.completeness,
    academic:
      dashboard.academic.availability === "AVAILABLE"
        ? {
            average: dashboard.academic.averageOverall,
            previousAverage: dashboard.academic.previousAverage,
            changePoints: dashboard.academic.changePoints,
            trend: dashboard.academic.trend,
            studentsRequiringAttention: dashboard.academic.studentsRequiringAttention,
            studentsImproving: dashboard.academic.studentsImproving,
            lowestPerformingClassAverage: dashboard.academic.primaryConcern?.averageOverall ?? null,
          }
        : null,
    attendance:
      dashboard.attendance.availability === "AVAILABLE"
        ? {
            rate: dashboard.attendance.attendanceRate,
            previousRate: dashboard.attendance.previousAttendanceRate,
            changePoints: dashboard.attendance.changePoints,
            trend: dashboard.attendance.trend,
            studentsWithConcern: dashboard.attendance.studentsWithConcern,
          }
        : null,
    financial:
      dashboard.financial.availability === "AVAILABLE"
        ? {
            collectionRatePercent: dashboard.financial.collectionRatePercent,
            overdueInvoiceCount: dashboard.financial.overdueInvoiceCount,
          }
        : null,
    operational: {
      attendanceCompletionRatePercent:
        dashboard.operational.attendanceCompletionToday.availability === "AVAILABLE" ? dashboard.operational.attendanceCompletionToday.ratePercent : null,
      resultCompletionRatePercent: dashboard.operational.resultCompletion.availability === "AVAILABLE" ? dashboard.operational.resultCompletion.ratePercent : null,
      pendingApprovals: dashboard.financial.pendingExpenseApprovals + dashboard.financial.pendingPaymentApprovals,
    },
  };
}

export async function generateSchoolHealthInsight(schoolId: string, actingUserId: string, dashboard: SchoolHealthDashboard): Promise<SchoolHealthAiInsight> {
  await requireFeature(schoolId, "ai_school_insights");
  const provider = getAiProvider();
  if (!provider) throw new Error("AI executive insights aren't configured for this deployment.");

  const payload = buildPromptPayload(dashboard);
  const result = await provider.generate({ systemPrompt: SYSTEM_PROMPT, messages: [{ role: "user", content: JSON.stringify(payload) }], tools: [] });
  if (result.type !== "text") throw new Error("Unexpected AI response format.");

  const insight = validateInsight(parseJsonResponse(result.text));

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "ai.school_health_insight_generated",
    resourceType: "School",
    resourceId: schoolId,
    newValue: { period: payload.period, healthScore: payload.healthScore, healthLevel: payload.healthLevel },
  });

  return insight;
}
