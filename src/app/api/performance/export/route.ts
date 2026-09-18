import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { getUserPermissions } from "@/lib/auth/permissions-resolve";
import { PERMISSIONS } from "@/lib/permissions";
import { rowsToCsv } from "@/lib/csv";
import { getClassPerformanceOverview, getSchoolPerformanceOverview } from "@/lib/services/performance/analysis";
import { PerformanceAccessDeniedError } from "@/lib/services/performance/authorization";
import type { StudentPerformanceAnalysis } from "@/lib/services/performance/types";

const HEADER = [
  "studentName",
  "admissionNumber",
  "class",
  "academicSession",
  "term",
  "currentAverage",
  "previousAverage",
  "change",
  "attendanceRate",
  "failedSubjects",
  "riskLevel",
  "primaryConcerns",
];

/// Deterministic fields only — deliberately never includes the
/// AI-generated narrative (summary/strengths/concerns/suggestedActions),
/// per the brief: "Do not expose AI-generated narrative unnecessarily in
/// bulk exports." Every number here already appears on the dashboard
/// this export is downloaded from.
function toRow(a: StudentPerformanceAnalysis): string[] {
  return [
    a.studentName,
    a.admissionNumber,
    a.className ?? "",
    a.metrics.period.academicSessionName,
    a.metrics.period.termName,
    a.metrics.overallAverage === null ? "" : String(a.metrics.overallAverage),
    a.trend.previous?.overallAverage === null || a.trend.previous?.overallAverage === undefined ? "" : String(a.trend.previous.overallAverage),
    a.trend.changePoints === null ? "" : String(a.trend.changePoints),
    a.attendance.attendanceRate === null ? "" : String(a.attendance.attendanceRate),
    String(a.metrics.subjectsFailed),
    a.risk.riskLevel,
    a.risk.reasons.join("; "),
  ];
}

/// Class-scoped (?classArmId=) or school-wide, both re-authorized here
/// exactly as the dashboards themselves are — a teacher can only export
/// a class they're actually assigned to, and never the school-wide
/// rollup, regardless of what URL they construct by hand.
export async function GET(request: Request) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const perms = await getUserPermissions(user.id);

  const url = new URL(request.url);
  const classArmId = url.searchParams.get("classArmId") || undefined;
  const termId = url.searchParams.get("termId") || undefined;

  let rows: string[][];
  let filenameParts: string[];

  try {
    if (classArmId) {
      const overview = await getClassPerformanceOverview(user.schoolId, user.id, perms, classArmId, termId);
      rows = overview.students.map(toRow);
      filenameParts = ["performance", overview.className, overview.termName];
    } else {
      const overview = await getSchoolPerformanceOverview(user.schoolId, user.id, perms, termId);
      rows = overview.allStudents.map(toRow);
      filenameParts = ["performance", "school-wide", overview.termName];
    }
  } catch (error) {
    if (error instanceof PerformanceAccessDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && (error.message === "Class not found." || error.message === "Term not found." || error.message === "No academic term available for analysis.")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const csv = rowsToCsv(HEADER, rows);
  const filename = filenameParts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
