import type {
  AcademicHealthMetrics,
  AttendanceHealthMetrics,
  FinancialHealthMetrics,
  OperationalHealthMetrics,
  HealthScoreComponent,
  HealthScoreWeights,
  HealthLevel,
  HealthCompleteness,
  SchoolHealthScore,
} from "./types";

// ---------------------------------------------------------------------
// Deterministic, explainable School Health Score.
//
// Every component score below is read straight from its own already-
// computed metrics (academic-health.ts / attendance-health.ts /
// financial-health.ts / operational-health.ts) — this file does no
// database work and calculates nothing about risk, attendance, money,
// or operations itself. It only combines four already-honest 0-100
// numbers into one, and only over the components that actually have
// data.
//
// WEIGHT NORMALIZATION — worked example (matches the brief exactly):
//   Configured weights: Academic 30, Attendance 25, Financial 25, Operational 20.
//   Financial is unavailable this period.
//   Available weight total = 30 + 25 + 20 = 75.
//   Each available component's normalized weight = its own weight / 75:
//     Academic:    30/75 = 0.40
//     Attendance:  25/75 = 0.333
//     Operational: 20/75 = 0.267
//   overallScore = academicScore*0.40 + attendanceScore*0.333 + operationalScore*0.267
//   Financial contributes nothing and is never treated as 0 — it is
//   simply excluded from both the numerator and the denominator.
// ---------------------------------------------------------------------

const LEVEL_BANDS: { min: number; level: HealthLevel }[] = [
  { min: 85, level: "EXCELLENT" },
  { min: 70, level: "GOOD" },
  { min: 50, level: "NEEDS_ATTENTION" },
  { min: 0, level: "CRITICAL" },
];

function levelForScore(score: number): HealthLevel {
  return LEVEL_BANDS.find((b) => score >= b.min)!.level;
}

export function computeSchoolHealthScore(
  academic: AcademicHealthMetrics,
  attendance: AttendanceHealthMetrics,
  financial: FinancialHealthMetrics,
  operational: OperationalHealthMetrics,
  weights: HealthScoreWeights
): SchoolHealthScore {
  const raw: { key: HealthScoreComponent["key"]; label: string; availability: typeof academic.availability; score: number | null; weight: number }[] = [
    { key: "academic", label: "Academic Health", availability: academic.availability, score: academic.score, weight: weights.healthScoreWeightAcademic },
    { key: "attendance", label: "Attendance Health", availability: attendance.availability, score: attendance.score, weight: weights.healthScoreWeightAttendance },
    { key: "financial", label: "Financial Health", availability: financial.availability, score: financial.score, weight: weights.healthScoreWeightFinancial },
    { key: "operational", label: "Operational Health", availability: operational.availability, score: operational.score, weight: weights.healthScoreWeightOperational },
  ];

  const available = raw.filter((c) => c.availability === "AVAILABLE" && c.score !== null);
  const availableWeightTotal = available.reduce((sum, c) => sum + c.weight, 0);

  const components: HealthScoreComponent[] = raw.map((c) => {
    const isAvailable = c.availability === "AVAILABLE" && c.score !== null;
    return {
      key: c.key,
      label: c.label,
      availability: c.availability,
      score: c.score,
      level: isAvailable ? levelForScore(c.score!) : null,
      configuredWeight: c.weight,
      normalizedWeight: isAvailable && availableWeightTotal > 0 ? Math.round((c.weight / availableWeightTotal) * 1000) / 1000 : null,
    };
  });

  const completeness: HealthCompleteness =
    available.length === 4 ? "FULL" : available.length === 3 ? "MOSTLY_COMPLETE" : available.length === 2 ? "PARTIAL" : available.length === 1 ? "SINGLE_COMPONENT" : "NO_DATA";

  // Per your explicit UX rule: a single available component never masquerades
  // as a whole-school score, and zero available components has nothing to score.
  if (completeness === "SINGLE_COMPONENT" || completeness === "NO_DATA" || availableWeightTotal === 0) {
    return { overallScore: null, overallLevel: null, completeness, components };
  }

  const overallScore = Math.round(available.reduce((sum, c) => sum + (c.score! * c.weight) / availableWeightTotal, 0));

  return { overallScore, overallLevel: levelForScore(overallScore), completeness, components };
}
