import { describe, it, expect } from "vitest";
import { computeStudentPerformanceTrend } from "@/lib/services/performance/trend";
import { computeSubjectPerformanceAnalysis } from "@/lib/services/performance/subject-analysis";
import { computeAttendancePerformanceAnalysis } from "@/lib/services/performance/attendance-analysis";
import { assessStudentRisk, computeStudentSuccessSignals } from "@/lib/services/performance/risk-engine";
import { computeCbtPracticeSignal } from "@/lib/services/performance/supplementary-signals";
import type { PerformancePeriod, StudentPerformanceMetrics, PerformanceThresholds, SubjectPerformanceRow } from "@/lib/services/performance/types";

const THRESHOLDS: PerformanceThresholds = {
  performancePassMark: 50,
  performanceSignificantChangePoints: 10,
  attendanceConcernThreshold: 80,
  performanceFailedSubjectConcernThreshold: 2,
};

function period(termName: string, startDate: string): PerformancePeriod {
  return { termId: termName, termName, academicSessionId: "s1", academicSessionName: "2025/2026", startDate: new Date(startDate) };
}

function subjects(scores: Record<string, number>, passMark = 50): SubjectPerformanceRow[] {
  return Object.entries(scores).map(([subjectName, percentage]) => ({
    subjectId: subjectName,
    subjectName,
    percentage,
    isPassing: percentage >= passMark,
  }));
}

function metrics(termId: string, scores: Record<string, number>): StudentPerformanceMetrics {
  const rows = subjects(scores);
  const overallAverage = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / rows.length) : null;
  return {
    studentId: "student-1",
    period: period(termId, "2025-09-01"),
    classArmId: "arm-1",
    subjects: rows,
    overallAverage,
    subjectsPassed: rows.filter((r) => r.isPassing).length,
    subjectsFailed: rows.filter((r) => !r.isPassing).length,
  };
}

const emptyAttendance = computeAttendancePerformanceAnalysis(undefined, undefined, 80);
const emptyCbt = computeCbtPracticeSignal(undefined);

describe("TEST 1 — declining student", () => {
  it("classifies DECLINING with the exact difference and correct risk reasons", () => {
    const current = metrics("t2", { Math: 58, English: 58 }); // overall 58
    const previous = metrics("t1", { Math: 78, English: 78 }); // overall 78

    const trend = computeStudentPerformanceTrend(current, [previous], THRESHOLDS.performanceSignificantChangePoints);
    expect(trend.status).toBe("DECLINING");
    expect(trend.changePoints).toBe(-20);

    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, previous, THRESHOLDS.performanceSignificantChangePoints);
    const risk = assessStudentRisk(trend, subjectAnalysis, emptyAttendance, emptyCbt, THRESHOLDS);
    expect(risk.reasons.some((r) => r.includes("declined by 20 percentage points"))).toBe(true);
    expect(risk.supportingMetrics.currentAverage).toBe(58);
    expect(risk.supportingMetrics.previousAverage).toBe(78);
  });
});

describe("TEST 2 — improving student", () => {
  it("classifies IMPROVING", () => {
    const current = metrics("t2", { Math: 78, English: 78 });
    const previous = metrics("t1", { Math: 55, English: 55 });
    const trend = computeStudentPerformanceTrend(current, [previous], THRESHOLDS.performanceSignificantChangePoints);
    expect(trend.status).toBe("IMPROVING");
    expect(trend.changePoints).toBe(23);
  });
});

describe("TEST 3 — no historical data", () => {
  it("returns INSUFFICIENT_DATA and never invents a trend", () => {
    const current = metrics("t1", { Math: 70 });
    const trend = computeStudentPerformanceTrend(current, [], THRESHOLDS.performanceSignificantChangePoints);
    expect(trend.status).toBe("INSUFFICIENT_DATA");
    expect(trend.changePoints).toBeNull();
    expect(trend.previous).toBeNull();
  });
});

describe("TEST 4 — subject decline identifies the primary concern", () => {
  it("flags Mathematics as NEEDS_ATTENTION and English as STABLE", () => {
    const current = metrics("t2", { Math: 52, English: 72 });
    const previous = metrics("t1", { Math: 80, English: 70 });
    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, previous, THRESHOLDS.performanceSignificantChangePoints);

    const math = subjectAnalysis.subjects.find((s) => s.subjectName === "Math")!;
    const english = subjectAnalysis.subjects.find((s) => s.subjectName === "English")!;
    expect(math.status).toBe("NEEDS_ATTENTION");
    expect(math.changePoints).toBe(-28);
    expect(english.status).toBe("STABLE");
    expect(subjectAnalysis.mostDeclinedSubject?.subjectName).toBe("Math");
    expect(subjectAnalysis.weakestSubject?.subjectName).toBe("Math");
  });
});

describe("TEST 5 — attendance concern", () => {
  it("flags attendance below the configured threshold", () => {
    const attendance = computeAttendancePerformanceAnalysis({ present: 72, absent: 28, late: 0, excused: 0, total: 100 }, undefined, 80);
    expect(attendance.attendanceRate).toBe(72);
    expect(attendance.isConcern).toBe(true);

    const current = metrics("t1", { Math: 80 }); // otherwise fine — attendance alone should surface as a reason
    const trend = computeStudentPerformanceTrend(current, [], THRESHOLDS.performanceSignificantChangePoints);
    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, null, THRESHOLDS.performanceSignificantChangePoints);
    const risk = assessStudentRisk(trend, subjectAnalysis, attendance, emptyCbt, THRESHOLDS);
    expect(risk.reasons.some((r) => r.includes("Attendance (72%)"))).toBe(true);
  });
});

describe("TEST 6 — combined high/critical risk", () => {
  it("scores HIGH/CRITICAL when overall is low, 4 subjects failed, attendance is low, and decline is large", () => {
    const current = metrics("t2", { Math: 30, English: 40, Biology: 45, Physics: 48, Chemistry: 55 }); // 4 of 5 below 50
    const previous = metrics("t1", { Math: 60, English: 65, Biology: 68, Physics: 70, Chemistry: 72 });
    const attendance = computeAttendancePerformanceAnalysis({ present: 71, absent: 29, late: 0, excused: 0, total: 100 }, undefined, 80);

    const trend = computeStudentPerformanceTrend(current, [previous], THRESHOLDS.performanceSignificantChangePoints);
    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, previous, THRESHOLDS.performanceSignificantChangePoints);
    const risk = assessStudentRisk(trend, subjectAnalysis, attendance, emptyCbt, THRESHOLDS);

    expect(current.subjectsFailed).toBe(4);
    expect(trend.status).toBe("DECLINING");
    expect(["HIGH", "CRITICAL"]).toContain(risk.riskLevel);
    expect(risk.reasons.length).toBeGreaterThanOrEqual(4);
  });
});

describe("TEST 7 — missing attendance is never penalized", () => {
  it("shows attendance as unavailable and adds no risk points for it", () => {
    const attendance = computeAttendancePerformanceAnalysis(undefined, undefined, 80);
    expect(attendance.availability).toBe("INSUFFICIENT_DATA");
    expect(attendance.attendanceRate).toBeNull();
    expect(attendance.isConcern).toBe(false);

    const current = metrics("t1", { Math: 80, English: 80 });
    const trend = computeStudentPerformanceTrend(current, [], THRESHOLDS.performanceSignificantChangePoints);
    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, null, THRESHOLDS.performanceSignificantChangePoints);
    const risk = assessStudentRisk(trend, subjectAnalysis, attendance, emptyCbt, THRESHOLDS);
    expect(risk.reasons.some((r) => r.toLowerCase().includes("attendance"))).toBe(false);
  });
});

describe("Success signals", () => {
  it("flags significant improvement and consistent high performance separately from risk", () => {
    const current = metrics("t2", { Math: 90, English: 88 });
    const previous = metrics("t1", { Math: 60, English: 58 });
    const trend = computeStudentPerformanceTrend(current, [previous], THRESHOLDS.performanceSignificantChangePoints);
    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, previous, THRESHOLDS.performanceSignificantChangePoints);
    const attendance = computeAttendancePerformanceAnalysis({ present: 95, absent: 5, late: 0, excused: 0, total: 100 }, undefined, 80);
    const success = computeStudentSuccessSignals(trend, subjectAnalysis, attendance, THRESHOLDS);

    expect(success.significantImprovement).toBe(true);
    expect(success.consistentHighPerformance).toBe(true);

    const risk = assessStudentRisk(trend, subjectAnalysis, attendance, emptyCbt, THRESHOLDS);
    expect(risk.riskLevel).toBe("LOW");
  });
});

describe("Explainability contract", () => {
  it("every risk result carries riskLevel, riskScore, reasons, supportingMetrics and analyzedAt", () => {
    const current = metrics("t1", { Math: 40 });
    const trend = computeStudentPerformanceTrend(current, [], THRESHOLDS.performanceSignificantChangePoints);
    const subjectAnalysis = computeSubjectPerformanceAnalysis(current, null, THRESHOLDS.performanceSignificantChangePoints);
    const risk = assessStudentRisk(trend, subjectAnalysis, emptyAttendance, emptyCbt, THRESHOLDS);

    expect(typeof risk.riskLevel).toBe("string");
    expect(typeof risk.riskScore).toBe("number");
    expect(Array.isArray(risk.reasons)).toBe(true);
    expect(risk.supportingMetrics).toBeDefined();
    expect(() => new Date(risk.analyzedAt).toISOString()).not.toThrow();
  });
});
