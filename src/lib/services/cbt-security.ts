import "server-only";
import { prisma } from "@/lib/db";
import type { CBTSecurityEventType, Prisma } from "@/generated/prisma/client";

/// Logged, never auto-accusatory (schema doc-comment on CBTSecurityEvent)
/// — this only ever records that something happened; nothing here flags,
/// scores, or penalizes a student on its own. A staff member with
/// cbt.view_results reviews the log and decides what, if anything, it
/// means.
///
/// Scoped to the attempt's owning student so one student can never log an
/// event against another's attempt, and silently ignored once the attempt
/// is no longer IN_PROGRESS (a stray event arriving after submission —
/// e.g. a debounced network retry — has nothing left to inform).
export async function logSecurityEvent(
  schoolId: string,
  studentId: string,
  attemptId: string,
  type: CBTSecurityEventType,
  metadata?: Prisma.InputJsonValue
) {
  const attempt = await prisma.cBTAttempt.findFirst({
    where: { schoolId, studentId, id: attemptId },
    select: { id: true, status: true },
  });
  if (!attempt || attempt.status !== "IN_PROGRESS") return null;

  return prisma.cBTSecurityEvent.create({
    data: { attemptId, type, metadata: metadata ?? undefined },
  });
}

export async function listSecurityEventsForExam(schoolId: string, examId: string) {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id: examId }, select: { id: true } });
  if (!exam) throw new Error("Exam not found.");

  return prisma.cBTSecurityEvent.findMany({
    where: { attempt: { examId, schoolId } },
    include: {
      attempt: {
        select: {
          id: true,
          attemptNumber: true,
          student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        },
      },
    },
    orderBy: { occurredAt: "desc" },
  });
}
