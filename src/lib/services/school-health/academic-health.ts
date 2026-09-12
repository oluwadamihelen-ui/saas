import "server-only";
import { prisma } from "@/lib/db";
import { getSchoolPerformanceOverview, getPerformanceThresholds } from "@/lib/services/performance/analysis";
import { listOrderedPeriods } from "@/lib/services/performance/periods";
import type { AcademicHealthMetrics, HealthTrendStatus, PeriodContext } from "./types";

/// Finds the nearest chronologically-prior term this school has ANY
/// scores in at all — a school-wide analogue of
/// performance/periods.ts's per-student search, since "previous
/// comparable period" here means one comparison number for the whole
/// school (brief: "compare the current term with the previous academic
/// term"), not each student's own individually-resolved previous period.
async function findPreviousSchoolTermWithScores(schoolId: string, currentTermId: string): Promise<string | null> {
  const orderedPeriods = await listOrderedPeriods(schoolId);
  const index = orderedPeriods.findIndex((p) => p.termId === currentTermId);
  if (index <= 0) return null;

  for (let i = index - 1; i >= 0; i--) {
    const candidate = orderedPeriods[i];
    const hasScore = await prisma.score.findFirst({ where: { schoolId, termId: candidate.termId }, select: { id: true } });
    if (hasScore) return candidate.termId;
  }
  return null;
}

/// Thin wrapper — every number here is read directly from
/// getSchoolPerformanceOverview() (Student Performance Analysis, built
/// separately and already tested). This file computes NOTHING about
/// risk, trend classification of individual students, or subject
/// analysis; it only reshapes the school-wide overview into the School
/// Health Dashboard's shape and adds the one thing Performance Analysis
/// doesn't itself track: a term-over-term SCHOOL average comparison.
export async function getAcademicHealth(
  schoolId: string,
  actingUserId: string,
  perms: Set<string>,
  period: PeriodContext
): Promise<AcademicHealthMetrics> {
  const current = await getSchoolPerformanceOverview(schoolId, actingUserId, perms, period.termId);

  if (current.studentsAnalyzed === 0 || current.averageOverall === null) {
    return {
      availability: "INSUFFICIENT_DATA",
      score: null,
      averageOverall: null,
      previousAverage: null,
      changePoints: null,
      trend: "INSUFFICIENT_DATA",
      studentsAnalyzed: current.studentsAnalyzed,
      studentsRequiringAttention: current.riskCounts.HIGH + current.riskCounts.CRITICAL,
      studentsImproving: current.trendCounts.improving,
      primaryConcern: null,
    };
  }

  const previousTermId = await findPreviousSchoolTermWithScores(schoolId, period.termId);
  const previous = previousTermId ? await getSchoolPerformanceOverview(schoolId, actingUserId, perms, previousTermId) : null;
  const previousAverage = previous?.averageOverall ?? null;

  let trend: HealthTrendStatus = "INSUFFICIENT_DATA";
  let changePoints: number | null = null;
  if (previousAverage !== null) {
    const thresholds = await getPerformanceThresholds(schoolId);
    changePoints = current.averageOverall - previousAverage;
    if (changePoints >= thresholds.performanceSignificantChangePoints) trend = "IMPROVING";
    else if (changePoints <= -thresholds.performanceSignificantChangePoints) trend = "DECLINING";
    else trend = "STABLE";
  }

  const classesWithData = current.classes.filter((c) => c.averageOverall !== null && c.studentCount > 0);
  const primaryConcern =
    classesWithData.length > 0
      ? classesWithData.reduce((worst, c) => (c.averageOverall! < worst.averageOverall! ? c : worst))
      : null;

  return {
    availability: "AVAILABLE",
    score: current.averageOverall,
    averageOverall: current.averageOverall,
    previousAverage,
    changePoints,
    trend,
    studentsAnalyzed: current.studentsAnalyzed,
    studentsRequiringAttention: current.riskCounts.HIGH + current.riskCounts.CRITICAL,
    studentsImproving: current.trendCounts.improving,
    primaryConcern: primaryConcern
      ? { classArmId: primaryConcern.classArmId, label: primaryConcern.className, averageOverall: primaryConcern.averageOverall! }
      : null,
  };
}
