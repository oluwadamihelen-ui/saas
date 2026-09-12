"use server";

import { requireSchoolUser } from "@/lib/auth/require";
import { getStudentForUser } from "@/lib/services/portal";
import { startAttempt, saveAnswer, submitAttempt } from "@/lib/services/cbt-attempts";
import { generateRevisionPlan, type RevisionPlanResult } from "@/lib/services/cbt-ai";
import { logSecurityEvent } from "@/lib/services/cbt-security";
import { notifyCbtExamSubmitted } from "@/lib/services/notifications";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { CBTSecurityEventType, Prisma } from "@/generated/prisma/client";

async function currentStudent() {
  const user = await requireSchoolUser();
  const student = await getStudentForUser(user.schoolId, user.id);
  if (!student) throw new Error("No student profile is linked to this account.");
  return { user, student };
}

export interface StartAttemptResult {
  status: "ok" | "error";
  message?: string;
  attemptId?: string;
}

export async function startAttemptAction(examId: string): Promise<StartAttemptResult> {
  const { user, student } = await currentStudent();
  try {
    const attempt = await startAttempt(user.schoolId, student.id, examId);
    return { status: "ok", attemptId: attempt.id };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not start the exam." };
  }
}

export interface SaveAnswerResult {
  status: "ok" | "error";
  message?: string;
}

export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  response: Prisma.InputJsonValue
): Promise<SaveAnswerResult> {
  const { user, student } = await currentStudent();
  try {
    await saveAnswer(user.schoolId, student.id, attemptId, questionId, response);
    return { status: "ok" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not save your answer." };
  }
}

export interface SubmitAttemptResult {
  status: "ok" | "error";
  message?: string;
}

export async function submitAttemptAction(attemptId: string): Promise<SubmitAttemptResult> {
  const { user, student } = await currentStudent();
  try {
    const attempt = await submitAttempt(user.schoolId, student.id, attemptId);
    const exam = await prisma.cBTExam.findUnique({ where: { id: attempt.examId }, select: { title: true } });
    await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_attempt.submitted", resourceType: "CBTAttempt", resourceId: attemptId });
    if (exam) await notifyCbtExamSubmitted(user.schoolId, student.id, exam.title);
    return { status: "ok" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not submit the exam." };
  }
}

/// Best-effort by design: a logging failure (network blip, race with the
/// attempt just having been submitted) must never surface as an error to
/// the student or interrupt them mid-exam — it's a side channel, not part
/// of the exam-taking flow itself.
export async function logSecurityEventAction(
  attemptId: string,
  type: CBTSecurityEventType,
  metadata?: Record<string, unknown>
): Promise<{ status: "ok" }> {
  try {
    const { user, student } = await currentStudent();
    await logSecurityEvent(user.schoolId, student.id, attemptId, type, metadata as Prisma.InputJsonValue);
  } catch {
    // swallow — see note above
  }
  return { status: "ok" };
}

export interface RevisionPlanActionResult {
  status: "ok" | "error";
  message?: string;
  plan?: RevisionPlanResult;
}

export async function generateRevisionPlanAction(examId: string): Promise<RevisionPlanActionResult> {
  const { user, student } = await currentStudent();
  try {
    const plan = await generateRevisionPlan(user.schoolId, student.id, examId);
    return { status: "ok", plan };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate a revision plan." };
  }
}
