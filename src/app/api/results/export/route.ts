import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";

const HEADER = ["sessionName", "termName", "admissionNumber", "subjectCode", "componentName", "score"];

/// A school-wide backup of every score on file, in the same column shape
/// the bulk importer accepts (see results-import.ts) — every session, not
/// just the current one, since this is meant as a full backup.
export async function GET() {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scores = await prisma.score.findMany({
    where: { schoolId: user.schoolId },
    include: {
      student: { select: { admissionNumber: true } },
      subject: { select: { code: true } },
      component: { select: { name: true } },
      term: { include: { academicSession: { select: { name: true } } } },
    },
    orderBy: [{ term: { startDate: "asc" } }, { student: { lastName: "asc" } }],
  });

  const rows = scores.map((s) => [
    s.term.academicSession.name,
    s.term.name,
    s.student.admissionNumber,
    s.subject.code,
    s.component.name,
    String(s.value),
  ]);

  const csv = rowsToCsv(HEADER, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-export.csv"`,
    },
  });
}
