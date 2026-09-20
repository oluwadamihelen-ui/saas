import "server-only";
import { prisma } from "@/lib/db";
import { listOrderedPeriods } from "@/lib/services/performance/periods";
import { getPerformanceThresholds } from "@/lib/services/performance/analysis";
import type { AttendanceHealthMetrics, HealthTrendStatus, PeriodContext } from "./types";

function rateFromCounts(counts: { status: string; count: number }[]): { rate: number; total: number } | null {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;
  const present = counts.filter((c) => c.status === "PRESENT" || c.status === "LATE").reduce((sum, c) => sum + c.count, 0);
  return { rate: Math.round((present / total) * 100), total };
}

/// One grouped aggregate query for the whole term — never one query per
/// student or per class (brief Test 10: 1,000+ students, no N+1).
async function overallRateForTerm(schoolId: string, termId: string): Promise<number | null> {
  const grouped = await prisma.attendanceRecord.groupBy({ by: ["status"], where: { schoolId, termId }, _count: { _all: true } });
  const counts = grouped.map((g) => ({ status: g.status, count: g._count._all }));
  return rateFromCounts(counts)?.rate ?? null;
}

async function findPreviousTermWithAttendance(schoolId: string, currentTermId: string): Promise<string | null> {
  const orderedPeriods = await listOrderedPeriods(schoolId);
  const index = orderedPeriods.findIndex((p) => p.termId === currentTermId);
  if (index <= 0) return null;
  for (let i = index - 1; i >= 0; i--) {
    const candidate = orderedPeriods[i];
    const hasRecord = await prisma.attendanceRecord.findFirst({ where: { schoolId, termId: candidate.termId }, select: { id: true } });
    if (hasRecord) return candidate.termId;
  }
  return null;
}

/// Term-scoped attendance HEALTH — a trend/quality metric for the
/// selected academic period. Deliberately separate from "today's
/// attendance completion," which is an operational, same-day snapshot
/// (see operational-health.ts) — the two answer different questions and
/// must never be shown as if they were the same number.
export async function getAttendanceHealth(schoolId: string, period: PeriodContext): Promise<AttendanceHealthMetrics> {
  const [overallGrouped, byClassStatus, byStudentStatus, classArms, thresholds] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { schoolId, termId: period.termId }, _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["classArmId", "status"], where: { schoolId, termId: period.termId }, _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { schoolId, termId: period.termId }, _count: { _all: true } }),
    prisma.classArm.findMany({ where: { schoolId }, include: { classGroup: true } }),
    getPerformanceThresholds(schoolId),
  ]);

  const overall = rateFromCounts(overallGrouped.map((g) => ({ status: g.status, count: g._count._all })));
  if (!overall) {
    return {
      availability: "INSUFFICIENT_DATA",
      score: null,
      attendanceRate: null,
      previousAttendanceRate: null,
      changePoints: null,
      trend: "INSUFFICIENT_DATA",
      studentsWithConcern: 0,
      lowestAttendanceClass: null,
    };
  }

  const previousTermId = await findPreviousTermWithAttendance(schoolId, period.termId);
  const previousAttendanceRate = previousTermId ? await overallRateForTerm(schoolId, previousTermId) : null;

  let trend: HealthTrendStatus = "INSUFFICIENT_DATA";
  let changePoints: number | null = null;
  if (previousAttendanceRate !== null) {
    changePoints = overall.rate - previousAttendanceRate;
    if (changePoints >= thresholds.performanceSignificantChangePoints) trend = "IMPROVING";
    else if (changePoints <= -thresholds.performanceSignificantChangePoints) trend = "DECLINING";
    else trend = "STABLE";
  }

  // Lowest-attendance class — grouped from byClassStatus, only classes
  // with actual recorded attendance this term (a class with none isn't
  // "0% attendance," it's simply not represented here).
  const classNameById = new Map(classArms.map((c) => [c.id, `${c.classGroup.name} ${c.name}`]));
  const countsByClass = new Map<string, { status: string; count: number }[]>();
  for (const row of byClassStatus) {
    if (!row.classArmId) continue;
    if (!countsByClass.has(row.classArmId)) countsByClass.set(row.classArmId, []);
    countsByClass.get(row.classArmId)!.push({ status: row.status, count: row._count._all });
  }
  let lowestAttendanceClass: AttendanceHealthMetrics["lowestAttendanceClass"] = null;
  for (const [classArmId, counts] of countsByClass) {
    const result = rateFromCounts(counts);
    if (!result) continue;
    if (!lowestAttendanceClass || result.rate < lowestAttendanceClass.rate) {
      lowestAttendanceClass = { classArmId, className: classNameById.get(classArmId) ?? "Unassigned", rate: result.rate };
    }
  }

  // Students with a concerning attendance rate this term — one grouped
  // query already fetched above, reduced in memory per student.
  const countsByStudent = new Map<string, { status: string; count: number }[]>();
  for (const row of byStudentStatus) {
    if (!countsByStudent.has(row.studentId)) countsByStudent.set(row.studentId, []);
    countsByStudent.get(row.studentId)!.push({ status: row.status, count: row._count._all });
  }
  let studentsWithConcern = 0;
  for (const counts of countsByStudent.values()) {
    const result = rateFromCounts(counts);
    if (result && result.rate < thresholds.attendanceConcernThreshold) studentsWithConcern++;
  }

  return {
    availability: "AVAILABLE",
    score: overall.rate,
    attendanceRate: overall.rate,
    previousAttendanceRate,
    changePoints,
    trend,
    studentsWithConcern,
    lowestAttendanceClass,
  };
}
