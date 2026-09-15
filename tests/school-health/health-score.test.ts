import { describe, it, expect } from "vitest";
import { computeSchoolHealthScore } from "@/lib/services/school-health/health-score";
import type {
  AcademicHealthMetrics,
  AttendanceHealthMetrics,
  FinancialHealthMetrics,
  OperationalHealthMetrics,
  HealthScoreWeights,
} from "@/lib/services/school-health/types";

const WEIGHTS: HealthScoreWeights = {
  healthScoreWeightAcademic: 30,
  healthScoreWeightAttendance: 25,
  healthScoreWeightFinancial: 25,
  healthScoreWeightOperational: 20,
};

function academic(score: number | null, availability: AcademicHealthMetrics["availability"] = "AVAILABLE"): AcademicHealthMetrics {
  return {
    availability,
    score,
    averageOverall: score,
    previousAverage: null,
    changePoints: null,
    trend: "INSUFFICIENT_DATA",
    studentsAnalyzed: 100,
    studentsRequiringAttention: 0,
    studentsImproving: 0,
    primaryConcern: null,
  };
}
function attendance(score: number | null, availability: AttendanceHealthMetrics["availability"] = "AVAILABLE"): AttendanceHealthMetrics {
  return {
    availability,
    score,
    attendanceRate: score,
    previousAttendanceRate: null,
    changePoints: null,
    trend: "INSUFFICIENT_DATA",
    studentsWithConcern: 0,
    lowestAttendanceClass: null,
  };
}
function financial(score: number | null, availability: FinancialHealthMetrics["availability"] = "AVAILABLE"): FinancialHealthMetrics {
  return {
    availability,
    score,
    expectedMinor: 0,
    collectedMinor: 0,
    outstandingMinor: 0,
    collectionRatePercent: score,
    overdueInvoiceCount: 0,
    approvedExpensesMinor: 0,
    pendingExpenseApprovals: 0,
    pendingPaymentApprovals: 0,
    paymentTrend: [],
  };
}
function operational(score: number | null, availability: OperationalHealthMetrics["availability"] = "AVAILABLE"): OperationalHealthMetrics {
  return {
    availability,
    score,
    attendanceCompletionToday: { availability: "INSUFFICIENT_DATA", classesCompleted: 0, classesTotal: 0, ratePercent: null },
    resultCompletion: { availability: "INSUFFICIENT_DATA", studentsApproved: 0, studentsTotal: 0, ratePercent: null },
    pendingExpenseApprovals: 0,
    pendingPaymentApprovals: 0,
    admissions: { availability: "NOT_APPLICABLE", pending: 0 },
    onlineLearning: { availability: "NOT_APPLICABLE", liveClassesToday: 0, liveClassesUpcoming: 0 },
  };
}

describe("TEST — all 4 components available", () => {
  it("computes a full weighted score and FULL completeness", () => {
    const result = computeSchoolHealthScore(academic(78), attendance(92), financial(65), operational(70), WEIGHTS);
    expect(result.completeness).toBe("FULL");
    // 78*0.30 + 92*0.25 + 65*0.25 + 70*0.20 = 23.4 + 23 + 16.25 + 14 = 76.65 -> 77
    expect(result.overallScore).toBe(77);
    expect(result.overallLevel).toBe("GOOD");
    expect(result.components).toHaveLength(4);
  });
});

describe("TEST 5 — weight normalization when Financial is unavailable", () => {
  it("normalizes over the remaining 75 points exactly per the documented worked example", () => {
    const result = computeSchoolHealthScore(academic(78), attendance(92), financial(null, "INSUFFICIENT_DATA"), operational(75), WEIGHTS);
    expect(result.completeness).toBe("MOSTLY_COMPLETE");

    const academicComponent = result.components.find((c) => c.key === "academic")!;
    const attendanceComponent = result.components.find((c) => c.key === "attendance")!;
    const operationalComponent = result.components.find((c) => c.key === "operational")!;
    const financialComponent = result.components.find((c) => c.key === "financial")!;

    // normalizedWeight is rounded to 3 decimal places for display.
    expect(academicComponent.normalizedWeight).toBeCloseTo(30 / 75, 2);
    expect(attendanceComponent.normalizedWeight).toBeCloseTo(25 / 75, 2);
    expect(operationalComponent.normalizedWeight).toBeCloseTo(20 / 75, 2);
    expect(financialComponent.normalizedWeight).toBeNull();
    expect(financialComponent.score).toBeNull();

    // 78*(30/75) + 92*(25/75) + 75*(20/75) = 31.2 + 30.667 + 20 = 81.87 -> 82
    expect(result.overallScore).toBe(82);
  });
});

describe("TEST — two components available (PARTIAL)", () => {
  it("labels completeness PARTIAL and still computes a normalized score", () => {
    const result = computeSchoolHealthScore(
      academic(80),
      attendance(null, "INSUFFICIENT_DATA"),
      financial(null, "INSUFFICIENT_DATA"),
      operational(60),
      WEIGHTS
    );
    expect(result.completeness).toBe("PARTIAL");
    // 80*(30/50) + 60*(20/50) = 48 + 24 = 72
    expect(result.overallScore).toBe(72);
  });
});

describe("TEST — one component available (SINGLE_COMPONENT)", () => {
  it("never computes an overall score from a single component", () => {
    const result = computeSchoolHealthScore(
      academic(80),
      attendance(null, "INSUFFICIENT_DATA"),
      financial(null, "INSUFFICIENT_DATA"),
      operational(null, "INSUFFICIENT_DATA"),
      WEIGHTS
    );
    expect(result.completeness).toBe("SINGLE_COMPONENT");
    expect(result.overallScore).toBeNull();
    expect(result.overallLevel).toBeNull();
    // The available component itself is still fully reported.
    const academicComponent = result.components.find((c) => c.key === "academic")!;
    expect(academicComponent.score).toBe(80);
    expect(academicComponent.level).toBe("GOOD");
  });
});

describe("TEST — no components available (NO_DATA)", () => {
  it("returns NO_DATA with a null overall score and no fabricated zero", () => {
    const result = computeSchoolHealthScore(
      academic(null, "INSUFFICIENT_DATA"),
      attendance(null, "INSUFFICIENT_DATA"),
      financial(null, "UNAVAILABLE"),
      operational(null, "INSUFFICIENT_DATA"),
      WEIGHTS
    );
    expect(result.completeness).toBe("NO_DATA");
    expect(result.overallScore).toBeNull();
    for (const c of result.components) {
      expect(c.score).toBeNull();
      expect(c.normalizedWeight).toBeNull();
    }
  });
});

describe("Missing data is never treated as zero", () => {
  it("a 0-scoring available component and a missing component produce different results", () => {
    const withZero = computeSchoolHealthScore(academic(0), attendance(90), financial(90), operational(90), WEIGHTS);
    const withMissing = computeSchoolHealthScore(academic(null, "INSUFFICIENT_DATA"), attendance(90), financial(90), operational(90), WEIGHTS);
    expect(withZero.overallScore).not.toBe(withMissing.overallScore);
    expect(withMissing.completeness).toBe("MOSTLY_COMPLETE");
    // Missing component excluded entirely -> average of the other three at their own normalized weights, well above the near-zero-dragged score.
    expect(withMissing.overallScore!).toBeGreaterThan(withZero.overallScore!);
  });
});

describe("Health level bands", () => {
  it.each([
    [90, "EXCELLENT"],
    [75, "GOOD"],
    [55, "NEEDS_ATTENTION"],
    [30, "CRITICAL"],
  ])("score %i maps to %s", (score, level) => {
    const result = computeSchoolHealthScore(academic(score), attendance(score), financial(score), operational(score), WEIGHTS);
    expect(result.overallLevel).toBe(level);
  });
});
