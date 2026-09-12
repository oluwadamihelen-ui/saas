"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createQuestion,
  updateQuestion,
  archiveQuestion,
  restoreQuestion,
  deleteQuestion,
  approveQuestion,
  parseImportCsv,
  commitImportRows,
  type QuestionInput,
  type QuestionOptionInput,
} from "@/lib/services/cbt-questions";
import { generateQuestionsWithAI, GENERATABLE_TYPES, type GenerateQuestionsInput } from "@/lib/services/cbt-ai";
import { logAudit } from "@/lib/audit";
import { recordImportBatch } from "@/lib/services/import-history";
import type { CBTQuestionType, CBTDifficulty } from "@/generated/prisma/client";

const questionFieldsSchema = z.object({
  subjectId: z.string().trim().min(1, "Choose a subject"),
  classGroupId: z.string().trim().optional().or(z.literal("")),
  type: z.enum([
    "MULTIPLE_CHOICE",
    "MULTIPLE_SELECT",
    "TRUE_FALSE",
    "SHORT_ANSWER",
    "FILL_IN_BLANK",
    "ESSAY",
    "MATCHING",
    "ORDERING",
  ]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  topic: z.string().trim().max(200).optional().or(z.literal("")),
  subtopic: z.string().trim().max(200).optional().or(z.literal("")),
  learningObjective: z.string().trim().max(500).optional().or(z.literal("")),
  prompt: z.string().trim().min(1, "The question prompt is required").max(4000),
  marks: z.coerce.number().int().min(1, "Marks must be at least 1").max(100),
  explanation: z.string().trim().max(2000).optional().or(z.literal("")),
  rubric: z.string().trim().max(2000).optional().or(z.literal("")),
  acceptedAnswers: z.string().trim().max(2000).optional().or(z.literal("")),
  tags: z.string().trim().max(500).optional().or(z.literal("")),
});

export interface QuestionFormState {
  status: "idle" | "error";
  message?: string;
}

function buildQuestionInput(formData: FormData): QuestionInput {
  const parsed = questionFieldsSchema.safeParse({
    subjectId: formData.get("subjectId"),
    classGroupId: formData.get("classGroupId") ?? "",
    type: formData.get("type"),
    difficulty: formData.get("difficulty"),
    topic: formData.get("topic") ?? "",
    subtopic: formData.get("subtopic") ?? "",
    learningObjective: formData.get("learningObjective") ?? "",
    prompt: formData.get("prompt"),
    marks: formData.get("marks"),
    explanation: formData.get("explanation") ?? "",
    rubric: formData.get("rubric") ?? "",
    acceptedAnswers: formData.get("acceptedAnswers") ?? "",
    tags: formData.get("tags") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Please check the question details.");
  }
  const data = parsed.data;

  const optionTexts = formData.getAll("optionText") as string[];
  const optionMatches = formData.getAll("optionMatch") as string[];
  const optionCorrectFlags = new Set(formData.getAll("optionCorrect") as string[]);
  const options: QuestionOptionInput[] = optionTexts
    .map((text, i) => ({
      text: text.trim(),
      matchText: optionMatches[i]?.trim() || null,
      isCorrect: optionCorrectFlags.has(String(i)),
      order: i,
    }))
    .filter((o) => o.text.length > 0);

  return {
    subjectId: data.subjectId,
    classGroupId: data.classGroupId || null,
    type: data.type as CBTQuestionType,
    difficulty: data.difficulty as CBTDifficulty,
    topic: data.topic || null,
    subtopic: data.subtopic || null,
    learningObjective: data.learningObjective || null,
    prompt: data.prompt,
    marks: data.marks,
    explanation: data.explanation || null,
    rubric: data.rubric || null,
    acceptedAnswers: data.acceptedAnswers
      ? data.acceptedAnswers.split(/[,\n]/).map((a) => a.trim()).filter(Boolean)
      : null,
    options,
    tagNames: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  };
}

export async function createQuestionAction(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);

  let input: QuestionInput;
  try {
    input = buildQuestionInput(formData);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Invalid input." };
  }

  let questionId: string;
  try {
    const question = await createQuestion(user.schoolId, user.id, input);
    questionId = question.id;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not create question." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "cbt_question.created",
    resourceType: "CBTQuestion",
    resourceId: questionId,
  });

  revalidatePath("/dashboard/cbt/question-bank");
  redirect("/dashboard/cbt/question-bank");
}

export async function updateQuestionAction(
  questionId: string,
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);

  let input: QuestionInput;
  try {
    input = buildQuestionInput(formData);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Invalid input." };
  }

  try {
    await updateQuestion(user.schoolId, questionId, input);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not update question." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "cbt_question.updated",
    resourceType: "CBTQuestion",
    resourceId: questionId,
  });

  revalidatePath("/dashboard/cbt/question-bank");
  revalidatePath(`/dashboard/cbt/question-bank/${questionId}/edit`);
  redirect("/dashboard/cbt/question-bank");
}

export async function archiveQuestionAction(questionId: string) {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  await archiveQuestion(user.schoolId, questionId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_question.archived", resourceType: "CBTQuestion", resourceId: questionId });
  revalidatePath("/dashboard/cbt/question-bank");
}

export async function restoreQuestionAction(questionId: string) {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  await restoreQuestion(user.schoolId, questionId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_question.restored", resourceType: "CBTQuestion", resourceId: questionId });
  revalidatePath("/dashboard/cbt/question-bank");
}

export async function deleteQuestionAction(questionId: string) {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  await deleteQuestion(user.schoolId, questionId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_question.deleted", resourceType: "CBTQuestion", resourceId: questionId });
  revalidatePath("/dashboard/cbt/question-bank");
}

export interface ImportPreviewState {
  status: "idle" | "error" | "previewed";
  message?: string;
  rows?: { rowNumber: number; prompt: string; errors: string[]; valid: boolean }[];
  validRowsJson?: string;
  fileName?: string;
}

export async function previewImportAction(
  _prev: ImportPreviewState,
  formData: FormData
): Promise<ImportPreviewState> {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a CSV file to upload." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { status: "error", message: "File is too large (max 2MB)." };
  }

  const text = await file.text();
  const { rows } = await parseImportCsv(user.schoolId, text);
  if (rows.length === 0) {
    return { status: "error", message: "No rows found in the file." };
  }

  const validRows = rows.filter((r) => r.data).map((r) => r.data!);

  return {
    status: "previewed",
    rows: rows.map((r) => ({
      rowNumber: r.rowNumber,
      prompt: r.raw.prompt || "(missing prompt)",
      errors: r.errors,
      valid: r.data !== null,
    })),
    validRowsJson: JSON.stringify(validRows),
    fileName: file.name,
  };
}

export interface ImportConfirmState {
  status: "idle" | "error" | "done";
  message?: string;
  created?: number;
}

export async function confirmImportAction(
  _prev: ImportConfirmState,
  formData: FormData
): Promise<ImportConfirmState> {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);

  const raw = formData.get("validRowsJson");
  if (typeof raw !== "string" || !raw) {
    return { status: "error", message: "Nothing to import — run the preview again." };
  }
  const fileName = String(formData.get("fileName") || "questions.csv");

  let rows: QuestionInput[];
  try {
    rows = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Could not read the previewed rows — run the preview again." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "error", message: "There are no valid rows to import." };
  }

  let created: number;
  try {
    created = await commitImportRows(user.schoolId, user.id, rows);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Import failed." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "cbt_question.imported",
    resourceType: "CBTQuestion",
    newValue: { count: created },
  });

  await recordImportBatch(user.schoolId, user.id, {
    dataType: "CBT_QUESTIONS",
    status: "COMPLETED",
    fileName,
    totalRows: rows.length,
    successCount: created,
    failedCount: 0,
  });

  revalidatePath("/dashboard/cbt/question-bank");
  revalidatePath("/dashboard/data/history");
  return { status: "done", created };
}

export async function approveQuestionAction(questionId: string) {
  const user = await requirePermission(PERMISSIONS.CBT_MANAGE_QUESTION_BANK);
  await approveQuestion(user.schoolId, user.id, questionId);
  await logAudit({ schoolId: user.schoolId, userId: user.id, action: "cbt_question.ai_approved", resourceType: "CBTQuestion", resourceId: questionId });
  revalidatePath("/dashboard/cbt/question-bank");
}

const generateSchema = z.object({
  subjectId: z.string().trim().min(1, "Choose a subject"),
  type: z.enum(GENERATABLE_TYPES),
  topic: z.string().trim().min(1, "Describe the topic"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  count: z.coerce.number().int().min(1).max(10),
});

export interface GenerateQuestionsState {
  status: "idle" | "error" | "done";
  message?: string;
  created?: number;
  skipped?: { prompt: string; reason: string }[];
}

export async function generateQuestionsAction(
  _prev: GenerateQuestionsState,
  formData: FormData
): Promise<GenerateQuestionsState> {
  const user = await requirePermission(PERMISSIONS.CBT_GENERATE_AI_QUESTIONS);

  const parsed = generateSchema.safeParse({
    subjectId: formData.get("subjectId"),
    type: formData.get("type"),
    topic: formData.get("topic"),
    difficulty: formData.get("difficulty"),
    count: formData.get("count"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the details." };
  }

  let result;
  try {
    result = await generateQuestionsWithAI(user.schoolId, user.id, parsed.data as GenerateQuestionsInput);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not generate questions." };
  }

  await logAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "cbt_question.ai_generated",
    resourceType: "CBTQuestion",
    newValue: { count: result.created, subjectId: parsed.data.subjectId, topic: parsed.data.topic },
  });

  revalidatePath("/dashboard/cbt/question-bank");
  return { status: "done", created: result.created, skipped: result.skipped };
}
