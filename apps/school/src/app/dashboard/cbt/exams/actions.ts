"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createExam,
  updateExam,
  publishExam,
  unpublishExam,
  archiveExam,
  deleteExam,
  createExamType,
  listApprovedQuestionsForSubject,
  type ExamInput,
} from "@/lib/services/cbt-exams";
import { releaseExamResults } from "@/lib/services/cbt-results";
import { logAudit } from "@/lib/audit";

const blueprintRuleSchema = z.object({
  topic: z.string().trim().max(200).optional().nullable(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().nullable(),
  count: z.coerce.number().int().min(1),
});

const examPayloadSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  examTypeId: z.string().trim().min(1, "Choose an exam type"),
  subjectId: z.string().trim().min(1, "Choose a subject"),
  termId: z.string().trim().min(1, "Choose a term"),
  assessmentComponentId: z.string().trim().optional().nullable(),
  instructions: z.string().trim().max(4000).optional().nullable(),
  isPractice: z.boolean(),
  questionSelectionMode: z.enum(["MANUAL", "BLUEPRINT"]),
  questionIds: z.array(z.string()),
  blueprintTotalQuestions: z.coerce.number().int().min(0).optional().nullable(),
  blueprintRules: z.array(blueprintRuleSchema),
  randomizeQuestionOrder: z.boolean(),
  randomizeOptionOrder: z.boolean(),
  negativeMarkingEnabled: z.boolean(),
  negativeMarkPerWrong: z.coerce.number().min(0),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(1),
  requireFullscreen: z.boolean(),
  detectTabSwitch: z.boolean(),
  restrictCopyPaste: z.boolean(),
  restrictRightClick: z.boolean(),
  maxAttempts: z.coerce.number().int().min(1),
  autoSubmitOnExpiry: z.boolean(),
  desktopOnly: z.boolean(),
  resultVisibility: z.enum(["IMMEDIATE", "AFTER_GRADING", "MANUAL_RELEASE"]),
  showCorrectAnswers: z.boolean(),
  showExplanations: z.boolean(),
  showRanking: z.boolean(),
  classArmIds: z.array(z.string()),
});

export type ExamPayload = z.infer<typeof examPayloadSchema>;

export interface ExamActionResult {
  status: "ok" | "error";
  message?: string;
  examId?: string;
}

export async function createExamAction(payload: ExamPayload): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_CREATE);

  const parsed = examPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the exam details." };
  }

  try {
    const exam = await createExam(user.schoolId, user.id, parsed.data as ExamInput);
    await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.created", resourceType: "CBTExam", resourceId: exam.id });
    revalidatePath("/dashboard/cbt/exams");
    return { status: "ok", examId: exam.id };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create exam." };
  }
}

export async function updateExamAction(examId: string, payload: ExamPayload): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_EDIT);

  const parsed = examPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the exam details." };
  }

  try {
    await updateExam(user.schoolId, examId, parsed.data as ExamInput);
    await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.updated", resourceType: "CBTExam", resourceId: examId });
    revalidatePath("/dashboard/cbt/exams");
    revalidatePath(`/dashboard/cbt/exams/${examId}`);
    return { status: "ok", examId };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update exam." };
  }
}

export async function publishExamAction(examId: string): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_PUBLISH);
  try {
    await publishExam(user.schoolId, user.id, examId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not publish exam." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.published", resourceType: "CBTExam", resourceId: examId });
  revalidatePath("/dashboard/cbt/exams");
  revalidatePath(`/dashboard/cbt/exams/${examId}`);
  return { status: "ok", examId };
}

export async function unpublishExamAction(examId: string): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_PUBLISH);
  try {
    await unpublishExam(user.schoolId, examId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not unpublish exam." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.unpublished", resourceType: "CBTExam", resourceId: examId });
  revalidatePath("/dashboard/cbt/exams");
  revalidatePath(`/dashboard/cbt/exams/${examId}`);
  return { status: "ok", examId };
}

export async function archiveExamAction(examId: string): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_EDIT);
  try {
    await archiveExam(user.schoolId, examId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not archive exam." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.archived", resourceType: "CBTExam", resourceId: examId });
  revalidatePath("/dashboard/cbt/exams");
  return { status: "ok", examId };
}

export async function deleteExamAction(examId: string): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_EDIT);
  try {
    await deleteExam(user.schoolId, examId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not delete exam." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.deleted", resourceType: "CBTExam", resourceId: examId });
  revalidatePath("/dashboard/cbt/exams");
  return { status: "ok" };
}

export async function createExamTypeAction(label: string): Promise<{ id: string; label: string } | { status: "error"; message: string }> {
  const user = await requirePermission(PERMISSIONS.CBT_CREATE);
  try {
    const type = await createExamType(user.schoolId, label);
    return { id: type.id, label: type.label };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not add exam type." };
  }
}

export async function fetchSubjectQuestionsAction(subjectId: string) {
  const user = await requirePermission(PERMISSIONS.CBT_CREATE);
  return listApprovedQuestionsForSubject(user.schoolId, subjectId);
}

export async function releaseExamResultsAction(examId: string): Promise<ExamActionResult> {
  const user = await requirePermission(PERMISSIONS.CBT_PUBLISH);
  try {
    await releaseExamResults(user.schoolId, examId);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not release results." };
  }
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_exam.results_released", resourceType: "CBTExam", resourceId: examId });
  revalidatePath(`/dashboard/cbt/exams/${examId}`);
  revalidatePath(`/dashboard/cbt/exams/${examId}/results`);
  return { status: "ok", examId };
}
