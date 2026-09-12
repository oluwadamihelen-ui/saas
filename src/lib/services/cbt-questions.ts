import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireFeature, requireCbtQuestionBankCapacity } from "@/lib/billing/entitlements";
import { parseCsvRecords } from "@/lib/csv";
import type { CBTQuestionType, CBTDifficulty, CBTQuestionStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

/// Types whose correctness lives in CBTQuestionOption rows (isCorrect for
/// MULTIPLE_CHOICE/MULTIPLE_SELECT/TRUE_FALSE, matchText pairs for
/// MATCHING, order for ORDERING) rather than in acceptedAnswers/rubric.
const OPTION_BASED_TYPES: CBTQuestionType[] = [
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "TRUE_FALSE",
  "MATCHING",
  "ORDERING",
];

export interface QuestionListFilters {
  search?: string;
  subjectId?: string;
  classGroupId?: string;
  type?: CBTQuestionType;
  difficulty?: CBTDifficulty;
  status?: CBTQuestionStatus;
  topic?: string;
  tagId?: string;
  page?: number;
}

/// Every function here takes schoolId first and folds it into the where
/// clause — same tenant-isolation convention as students.ts. Archived
/// questions are hidden by default (status filter defaults to "not
/// ARCHIVED") so the bank's day-to-day view doesn't fill up with retired
/// questions; pass status: "ARCHIVED" explicitly to see them.
export async function listQuestions(schoolId: string, filters: QuestionListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.CBTQuestionWhereInput = {
    schoolId,
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.classGroupId ? { classGroupId: filters.classGroupId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters.status ? { status: filters.status } : { status: { not: "ARCHIVED" } }),
    ...(filters.topic ? { topic: { contains: filters.topic, mode: "insensitive" } } : {}),
    ...(filters.tagId ? { tags: { some: { tagId: filters.tagId } } } : {}),
    ...(filters.search
      ? {
          OR: [
            { prompt: { contains: filters.search, mode: "insensitive" } },
            { topic: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [questions, total] = await Promise.all([
    prisma.cBTQuestion.findMany({
      where,
      include: {
        subject: true,
        classGroup: true,
        tags: { include: { tag: true } },
        createdBy: { select: { name: true } },
        _count: { select: { examLinks: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.cBTQuestion.count({ where }),
  ]);

  return { questions, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getQuestion(schoolId: string, id: string) {
  return prisma.cBTQuestion.findFirst({
    where: { schoolId, id },
    include: {
      subject: true,
      classGroup: true,
      options: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { examLinks: true } },
    },
  });
}

export async function listTags(schoolId: string) {
  return prisma.cBTQuestionTag.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

/// Splits on commas, trims, drops blanks/dupes, then upserts each name so
/// the tag list stays school-scoped and free of near-duplicates from
/// re-typing an existing tag with different casing/whitespace.
async function resolveTagIds(schoolId: string, tagNames: string[]): Promise<string[]> {
  const names = [...new Set(tagNames.map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return [];

  return Promise.all(
    names.map(async (name) => {
      const tag = await prisma.cBTQuestionTag.upsert({
        where: { schoolId_name: { schoolId, name } },
        create: { schoolId, name },
        update: {},
      });
      return tag.id;
    })
  );
}

export interface QuestionOptionInput {
  text: string;
  matchText?: string | null;
  isCorrect?: boolean;
  order?: number;
}

export interface QuestionInput {
  subjectId: string;
  classGroupId?: string | null;
  type: CBTQuestionType;
  difficulty: CBTDifficulty;
  topic?: string | null;
  subtopic?: string | null;
  learningObjective?: string | null;
  prompt: string;
  marks: number;
  explanation?: string | null;
  acceptedAnswers?: string[] | null;
  rubric?: string | null;
  options: QuestionOptionInput[];
  tagNames: string[];
}

function validateQuestionInput(input: QuestionInput) {
  if (OPTION_BASED_TYPES.includes(input.type)) {
    if (input.options.length < 2) {
      throw new Error("Add at least two options.");
    }
    // ORDERING's answer key is the option order itself, and MATCHING's is
    // each option's own text/matchText pairing — neither uses isCorrect.
    if (input.type !== "ORDERING" && input.type !== "MATCHING" && !input.options.some((o) => o.isCorrect)) {
      throw new Error("Mark at least one option as correct.");
    }
    if (input.type === "MULTIPLE_CHOICE" || input.type === "TRUE_FALSE") {
      const correctCount = input.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new Error("Exactly one option must be marked correct for this question type.");
      }
    }
    if (input.type === "MATCHING" && input.options.some((o) => !o.matchText?.trim())) {
      throw new Error("Every matching option needs a matching pair.");
    }
  } else if (input.type === "ESSAY") {
    // Rubric is optional guidance for the manual grader — not required.
  } else if (!input.acceptedAnswers || input.acceptedAnswers.filter((a) => a.trim()).length === 0) {
    throw new Error("Add at least one accepted answer.");
  }
}

/// Manually authored questions go straight to APPROVED — teacher
/// authorship IS the review, per spec sections 6-7. Only AI-generated
/// questions (Phase 7) land in AI_PENDING_REVIEW and need a separate
/// approval step before becoming usable.
export async function createQuestion(schoolId: string, createdById: string, input: QuestionInput) {
  await requireFeature(schoolId, "cbt");
  await requireCbtQuestionBankCapacity(schoolId);
  validateQuestionInput(input);
  const tagIds = await resolveTagIds(schoolId, input.tagNames);

  return prisma.cBTQuestion.create({
    data: {
      schoolId,
      subjectId: input.subjectId,
      classGroupId: input.classGroupId || null,
      type: input.type,
      status: "APPROVED",
      source: "MANUAL",
      difficulty: input.difficulty,
      topic: input.topic || null,
      subtopic: input.subtopic || null,
      learningObjective: input.learningObjective || null,
      prompt: input.prompt,
      marks: input.marks,
      explanation: input.explanation || null,
      acceptedAnswers: input.acceptedAnswers?.length ? input.acceptedAnswers.filter((a) => a.trim()) : undefined,
      rubric: input.rubric || null,
      createdById,
      approvedById: createdById,
      approvedAt: new Date(),
      options: OPTION_BASED_TYPES.includes(input.type)
        ? {
            create: input.options.map((o, i) => ({
              text: o.text,
              matchText: o.matchText || null,
              isCorrect: Boolean(o.isCorrect),
              order: o.order ?? i,
            })),
          }
        : undefined,
      tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
  });
}

/// A LIVE exam's questions are protected from ordinary edits (spec section
/// 43) — that lock is enforced where CBTExamQuestion links are read
/// (Phase 3), not here, since a question can be edited freely up until
/// the moment an exam using it goes live.
export async function updateQuestion(schoolId: string, id: string, input: QuestionInput) {
  validateQuestionInput(input);
  const existing = await prisma.cBTQuestion.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Question not found.");

  const tagIds = await resolveTagIds(schoolId, input.tagNames);

  return prisma.$transaction(async (tx) => {
    await tx.cBTQuestionOption.deleteMany({ where: { questionId: id } });
    await tx.cBTQuestionTagAssignment.deleteMany({ where: { questionId: id } });

    return tx.cBTQuestion.update({
      where: { id },
      data: {
        subjectId: input.subjectId,
        classGroupId: input.classGroupId || null,
        type: input.type,
        difficulty: input.difficulty,
        topic: input.topic || null,
        subtopic: input.subtopic || null,
        learningObjective: input.learningObjective || null,
        prompt: input.prompt,
        marks: input.marks,
        explanation: input.explanation || null,
        acceptedAnswers: input.acceptedAnswers?.length ? input.acceptedAnswers.filter((a) => a.trim()) : Prisma.JsonNull,
        rubric: input.rubric || null,
        options: OPTION_BASED_TYPES.includes(input.type)
          ? {
              create: input.options.map((o, i) => ({
                text: o.text,
                matchText: o.matchText || null,
                isCorrect: Boolean(o.isCorrect),
                order: o.order ?? i,
              })),
            }
          : undefined,
        tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
    });
  });
}

/// The reversible "remove from the active bank" action — keeps the row
/// (and any CBTExamQuestion links a future exam already made to it)
/// intact, just hidden from listQuestions' default view and from exam
/// creation pickers.
export async function archiveQuestion(schoolId: string, id: string) {
  const existing = await prisma.cBTQuestion.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Question not found.");
  return prisma.cBTQuestion.update({ where: { id }, data: { status: "ARCHIVED" } });
}

export async function restoreQuestion(schoolId: string, id: string) {
  const existing = await prisma.cBTQuestion.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Question not found.");
  return prisma.cBTQuestion.update({ where: { id }, data: { status: "APPROVED" } });
}

/// The one and only path an AI_GENERATED question can reach APPROVED —
/// a human reviewer explicitly signs off, recorded the same way a
/// manually-authored question is self-approved at creation (spec
/// sections 6-7: AI output is never silently usable).
export async function approveQuestion(schoolId: string, approvedById: string, id: string) {
  const existing = await prisma.cBTQuestion.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Question not found.");
  if (existing.status !== "AI_PENDING_REVIEW") throw new Error("Only AI-generated questions pending review can be approved here.");
  return prisma.cBTQuestion.update({ where: { id }, data: { status: "APPROVED", approvedById, approvedAt: new Date() } });
}

/// Hard delete is only ever offered for a DRAFT or AI_PENDING_REVIEW
/// question — nothing else (an exam, an attempt, a manual grade) can
/// reference one yet, since neither status was ever eligible for exam
/// selection (spec sections 6-7: AI output isn't usable until approved).
/// Anything past those goes through archiveQuestion instead, so a future
/// exam link is never left dangling.
export async function deleteQuestion(schoolId: string, id: string) {
  const existing = await prisma.cBTQuestion.findFirst({ where: { schoolId, id } });
  if (!existing) throw new Error("Question not found.");
  if (existing.status !== "DRAFT" && existing.status !== "AI_PENDING_REVIEW") {
    throw new Error("Only draft or AI-pending questions can be permanently deleted. Archive it instead.");
  }
  await prisma.cBTQuestion.delete({ where: { id } });
}

// ---------------------------------------------------------------------
// CSV import (preview-then-confirm)
// ---------------------------------------------------------------------
// Template columns (header row required, any order):
//   subjectCode, type, difficulty, topic, prompt, marks,
//   option1, option1Correct, option2, option2Correct,
//   option3, option3Correct, option4, option4Correct, explanation
// v1 only supports the objective types a flat spreadsheet row can express
// unambiguously: MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE. Essay/
// matching/ordering questions need the full form and aren't importable.

export interface ImportRowResult {
  rowNumber: number;
  data: QuestionInput | null;
  raw: Record<string, string>;
  errors: string[];
}

const IMPORTABLE_TYPES = new Set(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE"]);

export async function parseImportCsv(
  schoolId: string,
  csvText: string
): Promise<{ rows: ImportRowResult[]; validCount: number }> {
  const { records } = parseCsvRecords(csvText);
  if (records.length === 0) return { rows: [], validCount: 0 };

  const subjects = await prisma.subject.findMany({ where: { schoolId }, select: { id: true, code: true, name: true } });
  const subjectByCode = new Map(subjects.map((s) => [s.code.toLowerCase(), s]));

  const rows: ImportRowResult[] = [];
  for (let i = 0; i < records.length; i++) {
    const raw = records[i];

    const errors: string[] = [];
    const subject = subjectByCode.get((raw.subjectcode ?? "").toLowerCase());
    if (!subject) errors.push(`Unknown subject code "${raw.subjectcode ?? ""}".`);

    const type = raw.type?.toUpperCase();
    if (!type || !IMPORTABLE_TYPES.has(type)) {
      errors.push(`Type must be one of ${[...IMPORTABLE_TYPES].join(", ")}.`);
    }

    const difficulty = (raw.difficulty || "MEDIUM").toUpperCase();
    if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) errors.push("Difficulty must be EASY, MEDIUM or HARD.");

    if (!raw.prompt?.trim()) errors.push("Prompt is required.");

    const marks = Number(raw.marks || "1");
    if (!Number.isFinite(marks) || marks <= 0) errors.push("Marks must be a positive number.");

    const options: QuestionOptionInput[] = [];
    for (let n = 1; n <= 6; n++) {
      const text = raw[`option${n}`];
      if (!text?.trim()) continue;
      options.push({
        text: text.trim(),
        isCorrect: ["true", "1", "yes", "y"].includes((raw[`option${n}correct`] || "").toLowerCase()),
        order: n - 1,
      });
    }
    if (type && IMPORTABLE_TYPES.has(type)) {
      if (options.length < 2) errors.push("At least two options are required.");
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount === 0) errors.push("At least one option must be marked correct.");
      if ((type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") && correctCount !== 1) {
        errors.push("Exactly one option must be marked correct for this type.");
      }
    }

    const data: QuestionInput | null =
      errors.length === 0
        ? {
            subjectId: subject!.id,
            type: type as CBTQuestionType,
            difficulty: difficulty as CBTDifficulty,
            topic: raw.topic?.trim() || null,
            prompt: raw.prompt.trim(),
            marks,
            explanation: raw.explanation?.trim() || null,
            options,
            tagNames: [],
          }
        : null;

    rows.push({ rowNumber: i + 2, data, raw, errors });
  }

  return { rows, validCount: rows.filter((r) => r.data).length };
}

export async function commitImportRows(schoolId: string, createdById: string, rows: QuestionInput[]) {
  await requireFeature(schoolId, "cbt_question_bank");
  await requireCbtQuestionBankCapacity(schoolId, rows.length);
  let created = 0;
  await prisma.$transaction(async (tx) => {
    for (const input of rows) {
      validateQuestionInput(input);
      await tx.cBTQuestion.create({
        data: {
          schoolId,
          subjectId: input.subjectId,
          type: input.type,
          status: "APPROVED",
          source: "IMPORTED",
          difficulty: input.difficulty,
          topic: input.topic || null,
          prompt: input.prompt,
          marks: input.marks,
          explanation: input.explanation || null,
          createdById,
          approvedById: createdById,
          approvedAt: new Date(),
          options: { create: input.options.map((o, i) => ({ text: o.text, isCorrect: Boolean(o.isCorrect), order: o.order ?? i })) },
        },
      });
      created++;
    }
  });
  return created;
}
