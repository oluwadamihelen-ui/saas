import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { computeReportCard, listGradeBands, gradeFor } from "@/lib/services/results";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Academic history (read-only — always recomputed live from Score/
// AttendanceRecord/ReportCard, exactly like computeReportCard itself, never
// cached or duplicated onto the Transcript row)
// ---------------------------------------------------------------------------

type ReportCardSubjectRow = Awaited<ReturnType<typeof computeReportCard>>["subjectRows"];

export interface TranscriptTermRow {
  termId: string;
  termName: string;
  /// The class this student was actually recorded in during this term,
  /// derived from their real AttendanceRecord rows for the term (or, for
  /// the student's current term only, their current classArm). Null means
  /// no such record exists — the UI must show "Not recorded", never guess.
  classLabel: string | null;
  subjectRows: ReportCardSubjectRow;
  overallAverage: number | null;
  position: number | null;
  classSize: number;
  reportCardStatus: "DRAFT" | "APPROVED" | "PUBLISHED";
}

export interface TranscriptSessionGroup {
  sessionId: string;
  sessionName: string;
  startDate: Date;
  endDate: Date;
  terms: TranscriptTermRow[];
}

/// Walks every term the student has at least one recorded Score in (the
/// same "did academic activity actually happen here" signal
/// computeReportCard itself relies on) across every academic session they
/// have ever been part of — not just the current one — and groups the
/// results by session. A term with zero Score rows for this student is
/// never given a fabricated entry.
export async function getStudentAcademicHistory(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { schoolId, id: studentId },
    include: { classArm: { include: { classGroup: true } } },
  });
  if (!student) throw new Error("Student not found");

  const termIdsWithScores = await prisma.score.findMany({
    where: { schoolId, studentId },
    select: { termId: true },
    distinct: ["termId"],
  });
  const termIds = [...new Set(termIdsWithScores.map((t) => t.termId))];

  if (termIds.length === 0) {
    return { student, sessions: [] as TranscriptSessionGroup[], isIncomplete: false };
  }

  const terms = await prisma.term.findMany({
    where: { schoolId, id: { in: termIds } },
    include: { academicSession: true },
    orderBy: { startDate: "asc" },
  });

  // Real, already-recorded class-per-term signal: AttendanceRecord stores
  // the classArmId a student was actually marked present/absent under for
  // a given term. Reusing it (rather than inventing a new tracking table)
  // lets each session honestly show the class the student was in at the
  // time, for any term that has attendance data.
  const attendanceByTerm = await prisma.attendanceRecord.findMany({
    where: { schoolId, studentId, termId: { in: termIds } },
    select: { termId: true, classArmId: true },
    distinct: ["termId"],
    orderBy: { date: "desc" },
  });
  const classArmIdByTerm = new Map(attendanceByTerm.map((a) => [a.termId, a.classArmId]));
  const classArmIds = [...new Set(attendanceByTerm.map((a) => a.classArmId))];
  const classArms = classArmIds.length
    ? await prisma.classArm.findMany({ where: { id: { in: classArmIds } }, include: { classGroup: true } })
    : [];
  const classArmById = new Map(classArms.map((c) => [c.id, c]));

  const sessionMap = new Map<string, TranscriptSessionGroup>();
  let anyMissingClass = false;

  for (const term of terms) {
    const { subjectRows, overallAverage, position, classSize, reportCard } = await computeReportCard(schoolId, studentId, term.id);

    const recordedClassArm = classArmIdByTerm.has(term.id) ? classArmById.get(classArmIdByTerm.get(term.id)!) : null;
    const classLabel = recordedClassArm
      ? `${recordedClassArm.classGroup.name} ${recordedClassArm.name}`
      : term.isCurrent && student.classArm
        ? `${student.classArm.classGroup.name} ${student.classArm.name}`
        : null;
    if (!classLabel) anyMissingClass = true;

    if (!sessionMap.has(term.academicSessionId)) {
      sessionMap.set(term.academicSessionId, {
        sessionId: term.academicSessionId,
        sessionName: term.academicSession.name,
        startDate: term.academicSession.startDate,
        endDate: term.academicSession.endDate,
        terms: [],
      });
    }
    sessionMap.get(term.academicSessionId)!.terms.push({
      termId: term.id,
      termName: term.name,
      classLabel,
      subjectRows,
      overallAverage,
      position,
      classSize,
      reportCardStatus: reportCard.status,
    });
  }

  const sessions = Array.from(sessionMap.values()).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return { student, sessions, isIncomplete: anyMissingClass };
}

export interface TranscriptSummary {
  sessionsAttended: number;
  classesCompleted: string[];
  yearsEnrolled: number;
  overallAverage: number | null;
  /// The school's own GradeBand remark for the overall average (e.g.
  /// "Excellent", "Good") — never an invented rating scale, and null
  /// whenever there isn't enough data to compute an average at all.
  performanceRemark: string | null;
}

export async function computeTranscriptSummary(
  schoolId: string,
  student: { admissionDate: Date },
  sessions: TranscriptSessionGroup[]
): Promise<TranscriptSummary> {
  const distinctClasses = new Set<string>();
  const averages: number[] = [];
  for (const session of sessions) {
    for (const term of session.terms) {
      if (term.classLabel) distinctClasses.add(term.classLabel);
      if (term.overallAverage !== null) averages.push(term.overallAverage);
    }
  }
  const overallAverage = averages.length > 0 ? Math.round(averages.reduce((sum, v) => sum + v, 0) / averages.length) : null;

  let performanceRemark: string | null = null;
  if (overallAverage !== null) {
    const bands = await listGradeBands(schoolId);
    performanceRemark = gradeFor(bands, overallAverage)?.remark ?? null;
  }

  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearsEnrolled = Math.max(1, Math.round((Date.now() - student.admissionDate.getTime()) / msPerYear));

  return {
    sessionsAttended: sessions.length,
    classesCompleted: Array.from(distinctClasses),
    yearsEnrolled,
    overallAverage,
    performanceRemark,
  };
}

// ---------------------------------------------------------------------------
// Transcript records (issuance, history, verification, revocation)
// ---------------------------------------------------------------------------

async function nextReferenceNumber() {
  const year = new Date().getFullYear();
  const total = await prisma.transcript.count();
  for (let attempt = 0; attempt < 20; attempt++) {
    const sequence = String(total + 1 + attempt).padStart(6, "0");
    const candidate = `WIN-TR-${year}-${sequence}`;
    const exists = await prisma.transcript.findUnique({ where: { referenceNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new Error("Could not allocate a transcript reference number");
}

export async function generateTranscript(schoolId: string, studentId: string, generatedById: string) {
  const student = await prisma.student.findFirst({ where: { schoolId, id: studentId } });
  if (!student) throw new Error("Student not found");

  const history = await getStudentAcademicHistory(schoolId, studentId);
  if (history.sessions.length === 0) {
    throw new Error("No academic records are currently available for this student.");
  }

  const verificationCode = crypto.randomBytes(16).toString("hex");

  let transcript: Awaited<ReturnType<typeof prisma.transcript.create>> | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5 && !transcript; attempt++) {
    try {
      const referenceNumber = await nextReferenceNumber();
      transcript = await prisma.transcript.create({
        data: { schoolId, studentId, referenceNumber, verificationCode, generatedById },
      });
    } catch (error) {
      lastError = error;
    }
  }
  if (!transcript) throw lastError instanceof Error ? lastError : new Error("Could not generate transcript");

  await logAudit({
    schoolId,
    userId: generatedById,
    action: "transcript.generated",
    resourceType: "Transcript",
    resourceId: transcript.id,
    newValue: { referenceNumber: transcript.referenceNumber, studentId },
  });

  return transcript;
}

export async function listTranscriptsForStudent(schoolId: string, studentId: string) {
  return prisma.transcript.findMany({
    where: { schoolId, studentId },
    include: { generatedBy: { select: { name: true } }, revokedBy: { select: { name: true } } },
    orderBy: { generatedAt: "desc" },
  });
}

export async function listTranscriptsForSchool(
  schoolId: string,
  input: { query?: string; page?: number; pageSize?: number } = {}
) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? 20;
  const query = input.query?.trim();

  const where: Prisma.TranscriptWhereInput = {
    schoolId,
    ...(query
      ? {
          student: {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { admissionNumber: { contains: query, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [total, transcripts] = await Promise.all([
    prisma.transcript.count({ where }),
    prisma.transcript.findMany({
      where,
      include: { student: true, generatedBy: { select: { name: true } } },
      orderBy: { generatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { transcripts, total, page, pageSize };
}

export async function getTranscript(schoolId: string, transcriptId: string) {
  return prisma.transcript.findFirst({
    where: { schoolId, id: transcriptId },
    include: {
      school: true,
      student: { include: { classArm: { include: { classGroup: true } } } },
      generatedBy: { select: { name: true } },
      revokedBy: { select: { name: true } },
    },
  });
}

export async function revokeTranscript(schoolId: string, transcriptId: string, revokedById: string, reason?: string) {
  const existing = await prisma.transcript.findFirst({ where: { schoolId, id: transcriptId } });
  if (!existing) throw new Error("Transcript not found");
  if (existing.status === "REVOKED") return existing;

  const transcript = await prisma.transcript.update({
    where: { id: transcriptId },
    data: { status: "REVOKED", revokedById, revokedAt: new Date(), revokedReason: reason || null },
  });

  await logAudit({
    schoolId,
    userId: revokedById,
    action: "transcript.revoked",
    resourceType: "Transcript",
    resourceId: transcript.id,
    previousValue: { status: existing.status },
    newValue: { status: "REVOKED", reason: reason || null },
  });

  return transcript;
}

export async function recordTranscriptEvent(
  schoolId: string,
  userId: string,
  transcriptId: string,
  event: "downloaded" | "printed"
) {
  await logAudit({ schoolId, userId, action: `transcript.${event}`, resourceType: "Transcript", resourceId: transcriptId });
}

/// Global (cross-school) lookup by reference number for the public
/// /verify-transcript page — deliberately returns only the minimal fields
/// the spec allows on that page (status, student name, school name, date
/// issued), never academic records, and never requires knowing the school
/// up front since a reference number alone must be enough to verify.
export async function verifyTranscriptPublic(referenceNumber: string) {
  const transcript = await prisma.transcript.findUnique({
    where: { referenceNumber },
    include: {
      school: { select: { name: true, logoUrl: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!transcript) return null;

  return {
    status: transcript.status,
    referenceNumber: transcript.referenceNumber,
    schoolName: transcript.school.name,
    schoolLogoUrl: transcript.school.logoUrl,
    studentName: `${transcript.student.firstName} ${transcript.student.lastName}`,
    generatedAt: transcript.generatedAt,
  };
}
