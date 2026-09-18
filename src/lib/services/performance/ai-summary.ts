import "server-only";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { requireFeature } from "@/lib/billing/entitlements";
import { logAudit } from "@/lib/audit";
import type { StudentPerformanceAnalysis } from "./types";

export function isPerformanceAiConfigured(): boolean {
  return getAiProvider() !== null;
}

// ---------------------------------------------------------------------
// AI-generated performance summary — an optional narrative layer over
// the deterministic engine's own output, modeled on
// cbt-ai.ts's generateExamInsights()/generateRevisionPlan(): a one-shot
// call fed only already-computed structured metrics (never raw scores
// the model could misreport, never medical/address/guardian data), with
// a strict JSON response format that is validated before use, never
// trusted as-is.
//
// The model NEVER computes riskLevel, trend, or any number here — every
// figure it's allowed to reference is already in the prompt, already
// verified by the deterministic engine above. Its only job is to turn
// that into readable prose plus generic, non-diagnostic suggestions.
// ---------------------------------------------------------------------

const SYSTEM_PROMPT = `You write a short academic performance summary for a school administrator or teacher, using ONLY the \
structured metrics you are given — never invent a number, score, trend or risk level that isn't in the input. \
Respond with ONLY a JSON object of the shape {"summary": string, "strengths": string[], "concerns": string[], \
"suggestedActions": string[]} — no prose outside the JSON, no markdown fences. \
"summary" is 2-4 plain sentences describing this student's academic performance, trend and attendance using the \
given first name. "strengths" is 0-4 short bullet points of genuine positives from the data (strong subjects, \
improvement, good attendance) — omit entirely if there are none. "concerns" is 0-4 short bullet points naming the \
specific data-backed concerns (a subject, a decline, attendance) — omit entirely if there are none. \
"suggestedActions" is 2-4 short, generic, non-disciplinary educational suggestions (e.g. "Review Mathematics \
fundamentals", "Schedule additional support", "Discuss attendance with parent/guardian", "Monitor next assessment") \
— these are optional ideas for a human to consider, never instructions. \
Never diagnose or suggest a medical, psychological, learning, or behavioural condition (no ADHD, depression, \
learning disability, disorder, or similar) — if support seems warranted, say only that the student "may benefit \
from additional academic support," nothing more specific. Never recommend disciplinary action. Keep language \
constructive and professional.`;

export interface PerformanceAiSummary {
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

function validateSummary(value: unknown): PerformanceAiSummary {
  if (!value || typeof value !== "object") throw new Error("Unexpected AI response shape.");
  const v = value as Record<string, unknown>;
  const summary = typeof v.summary === "string" ? v.summary.trim() : "";
  if (!summary) throw new Error("The AI response was missing a summary.");
  const asStringArray = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 4) : []);
  return {
    summary,
    strengths: asStringArray(v.strengths),
    concerns: asStringArray(v.concerns),
    suggestedActions: asStringArray(v.suggestedActions),
  };
}

/// Minimal, deliberately-shaped input — only the first name (never the
/// admission number, class, or any contact/medical field) plus the exact
/// already-verified numbers from the deterministic engine (brief:
/// "prefer anonymized or minimal identifiers ... rather than full
/// student profiles").
function buildPromptPayload(firstName: string, analysis: StudentPerformanceAnalysis) {
  return {
    firstName,
    period: `${analysis.metrics.period.academicSessionName} ${analysis.metrics.period.termName}`,
    currentAverage: analysis.metrics.overallAverage,
    previousAverage: analysis.trend.previous?.overallAverage ?? null,
    changePoints: analysis.trend.changePoints,
    trend: analysis.trend.status,
    subjects: analysis.subjectAnalysis.subjects.map((s) => ({ subject: s.subjectName, current: s.current, changePoints: s.changePoints, status: s.status })),
    attendanceRate: analysis.attendance.availability === "AVAILABLE" ? analysis.attendance.attendanceRate : null,
    attendanceChangePoints: analysis.attendance.availability === "AVAILABLE" ? analysis.attendance.changePoints : null,
    riskLevel: analysis.risk.riskLevel,
    riskReasons: analysis.risk.reasons,
    significantImprovement: analysis.success.significantImprovement,
    consistentHighPerformance: analysis.success.consistentHighPerformance,
  };
}

export async function generatePerformanceSummary(
  schoolId: string,
  actingUserId: string,
  studentId: string,
  firstName: string,
  analysis: StudentPerformanceAnalysis
): Promise<PerformanceAiSummary> {
  await requireFeature(schoolId, "ai_performance_analysis");
  const provider = getAiProvider();
  if (!provider) throw new Error("AI performance insights aren't configured for this deployment.");

  const payload = buildPromptPayload(firstName, analysis);
  const result = await provider.generate({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    tools: [],
  });
  if (result.type !== "text") throw new Error("Unexpected AI response format.");

  const summary = validateSummary(parseJsonResponse(result.text));

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "ai.performance_summary_generated",
    resourceType: "Student",
    resourceId: studentId,
    newValue: { period: payload.period, riskLevel: payload.riskLevel },
  });

  return summary;
}
