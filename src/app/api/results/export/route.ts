import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { rowsToCsv } from "@/lib/csv";
import type { Prisma } from "@/generated/prisma/client";

const HEADER = ["sessionName", "termName", "className", "admissionNumber", "subjectCode", "componentName", "score"];

/// A school's score records, in the same column shape the bulk importer
/// accepts (see results-import.ts) so the file round-trips — export from
/// one environment, import into another, historical class included.
///
/// With no filters, this is the original full-backup behavior: every
/// score ever recorded, unfiltered. Optional sessionId/termId/
/// classArmId/subjectId query params narrow it to one session/term/
/// class/subject — each resolved and ownership-checked against this
/// user's own school server-side (never trusted as a bare id from the
/// query string), per the multi-school isolation requirement.
///
/// classArmId filters on Score's OWN recorded class (the historical
/// fact — see prisma/schema.prisma's Score.classArmId doc comment),
/// never the student's current class, and — the historical-accuracy
/// requirement — a class-specific export excludes any row with no
/// verified class on record (classArmId null) rather than guessing
/// which class it might belong to. An unfiltered/school-wide export
/// still includes those rows, with className left blank, so a school
/// backing up everything doesn't silently lose rows that predate this
/// feature or were imported without a class.
export async function GET(request: Request) {
  const user = await requirePermission(PERMISSIONS.RESULTS_VIEW).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || undefined;
  const termId = url.searchParams.get("termId") || undefined;
  const classArmId = url.searchParams.get("classArmId") || undefined;
  const subjectId = url.searchParams.get("subjectId") || undefined;

  const where: Prisma.ScoreWhereInput = { schoolId: user.schoolId };
  const filenameParts = ["results"];

  if (termId) {
    const term = await prisma.term.findFirst({ where: { schoolId: user.schoolId, id: termId }, include: { academicSession: true } });
    if (!term) return NextResponse.json({ error: "Term not found." }, { status: 400 });
    if (sessionId && term.academicSessionId !== sessionId) {
      return NextResponse.json({ error: "That term does not belong to the selected session." }, { status: 400 });
    }
    where.termId = term.id;
    filenameParts.push(term.academicSession.name, term.name);
  } else if (sessionId) {
    const session = await prisma.academicSession.findFirst({ where: { schoolId: user.schoolId, id: sessionId } });
    if (!session) return NextResponse.json({ error: "Academic session not found." }, { status: 400 });
    where.term = { academicSessionId: session.id };
    filenameParts.push(session.name);
  }

  if (classArmId) {
    const classArm = await prisma.classArm.findFirst({ where: { schoolId: user.schoolId, id: classArmId }, include: { classGroup: true } });
    if (!classArm) return NextResponse.json({ error: "Class not found." }, { status: 400 });
    where.classArmId = classArm.id; // Score's own historical class — never student.classArmId.
    filenameParts.push(classArm.classGroup.name, classArm.name);
  }

  if (subjectId) {
    const subject = await prisma.subject.findFirst({ where: { schoolId: user.schoolId, id: subjectId } });
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 400 });
    where.subjectId = subject.id;
    filenameParts.push(subject.name);
  }

  const scores = await prisma.score.findMany({
    where,
    include: {
      student: { select: { admissionNumber: true } },
      subject: { select: { code: true } },
      component: { select: { name: true } },
      classArm: { include: { classGroup: true } },
      term: { include: { academicSession: { select: { name: true } } } },
    },
    orderBy: [{ term: { startDate: "asc" } }, { student: { lastName: "asc" } }],
  });

  const rows = scores.map((s) => [
    s.term.academicSession.name,
    s.term.name,
    s.classArm ? `${s.classArm.classGroup.name} ${s.classArm.name}` : "",
    s.student.admissionNumber,
    s.subject.code,
    s.component.name,
    String(s.value),
  ]);

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
