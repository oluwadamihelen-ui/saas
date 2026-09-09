import "server-only";
import { prisma } from "@/lib/db";
import { saveScores } from "@/lib/services/results";
import { notifyCbtManualGradingRequired, notifyCbtResultAvailable } from "@/lib/services/notifications";
import type { CBTQuestionType } from "@/generated/prisma/client";

/// ESSAY is the only type that always needs a human — every other type
/// has a determinable correct answer and is graded automatically the
/// moment an attempt is submitted (spec section 17). AI must never
/// silently finalize a subjective mark (section 31); Phase 7 will let AI
/// *suggest* a mark/feedback for the manual queue, never write the final
/// one itself — that's why CBTManualGrade.marksAwarded is always set by
/// the human grader in gradeAnswer() below, with aiSuggested* only ever
/// read, never copied in automatically.
const AUTO_GRADABLE_TYPES: CBTQuestionType[] = [
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "FILL_IN_BLANK",
  "MATCHING",
  "ORDERING",
];

interface QuestionForGrading {
  id: string;
  type: CBTQuestionType;
  acceptedAnswers: unknown;
  options: { id: string; text: string; matchText: string | null; isCorrect: boolean; order: number }[];
}

interface GradedAnswer {
  isCorrect: boolean | null;
  marksAwarded: number;
  gradingStatus: "AUTO_GRADED" | "NEEDS_MANUAL_GRADING";
}

/// All-or-nothing for MULTIPLE_CHOICE/MULTIPLE_SELECT/TRUE_FALSE/
/// SHORT_ANSWER/FILL_IN_BLANK/ORDERING (the conventional LMS treatment —
/// a "mostly right" selection isn't a partially right answer). MATCHING
/// is graded proportionally since it's really N independent pairs.
/// negativeMarkingEnabled only ever penalizes an ANSWERED-and-wrong
/// all-or-nothing question — an unanswered one scores 0 with no penalty,
/// and MATCHING/ESSAY are never penalized (partial credit and negative
/// marking don't compose cleanly, so this scopes negative marking to the
/// unambiguous cases per spec section 18's "configurable, off by
/// default" without inventing an unspecified partial-penalty rule).
function gradeObjectiveAnswer(
  question: QuestionForGrading,
  response: unknown,
  negativeMarkingEnabled: boolean,
  negativeMarkPerWrong: number,
  marks: number
): GradedAnswer {
  const answered =
    response !== null &&
    response !== undefined &&
    !(Array.isArray(response) && response.length === 0) &&
    !(typeof response === "string" && response.trim().length === 0);
  const penalty = () => (negativeMarkingEnabled ? -negativeMarkPerWrong : 0);

  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE": {
      const correctOption = question.options.find((o) => o.isCorrect);
      const isCorrect = answered && response === correctOption?.id;
      return { isCorrect, marksAwarded: isCorrect ? marks : answered ? penalty() : 0, gradingStatus: "AUTO_GRADED" };
    }
    case "MULTIPLE_SELECT": {
      const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
      const selected = new Set(Array.isArray(response) ? (response as string[]) : []);
      const isCorrect =
        answered && selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));
      return { isCorrect, marksAwarded: isCorrect ? marks : answered ? penalty() : 0, gradingStatus: "AUTO_GRADED" };
    }
    case "SHORT_ANSWER":
    case "FILL_IN_BLANK": {
      const accepted = (Array.isArray(question.acceptedAnswers) ? (question.acceptedAnswers as string[]) : []).map((a) =>
        a.trim().toLowerCase()
      );
      const text = typeof response === "string" ? response.trim().toLowerCase() : "";
      const isCorrect = answered && accepted.includes(text);
      return { isCorrect, marksAwarded: isCorrect ? marks : answered ? penalty() : 0, gradingStatus: "AUTO_GRADED" };
    }
    case "ORDERING": {
      const correctOrder = [...question.options].sort((a, b) => a.order - b.order).map((o) => o.id);
      const submitted = Array.isArray(response) ? (response as string[]) : [];
      const isCorrect = answered && submitted.length === correctOrder.length && submitted.every((id, i) => id === correctOrder[i]);
      return { isCorrect, marksAwarded: isCorrect ? marks : answered ? penalty() : 0, gradingStatus: "AUTO_GRADED" };
    }
    default:
      // MATCHING goes through gradeMatchingAnswer (it needs the
      // attempt-question's shuffled pool order) and ESSAY is filtered out
      // before this is ever called — gradeAttempt never reaches here with
      // either type.
      throw new Error(`${question.type} is not graded by gradeObjectiveAnswer.`);
  }
}

function gradeMatchingAnswer(
  options: { id: string }[],
  poolOrder: string[],
  response: unknown,
  marks: number
): GradedAnswer {
  const map = response && typeof response === "object" ? (response as Record<string, number>) : {};
  if (Object.keys(map).length === 0) return { isCorrect: false, marksAwarded: 0, gradingStatus: "AUTO_GRADED" };

  let correctPairs = 0;
  for (const option of options) {
    const chosenIndex = map[option.id];
    if (typeof chosenIndex === "number" && poolOrder[chosenIndex] === option.id) correctPairs++;
  }
  const fraction = correctPairs / options.length;
  return { isCorrect: fraction === 1, marksAwarded: Math.round(marks * fraction * 100) / 100, gradingStatus: "AUTO_GRADED" };
}

/// Runs immediately after an attempt is submitted (or auto-submitted) —
/// grades every auto-gradable answer, leaves ESSAY answers pending, and
/// only marks the attempt GRADED (computing its final score) once
/// nothing is left needing a human. Safe to call more than once: every
/// write here is an upsert to the same deterministic values, and an
/// already-GRADED attempt returns immediately.
export async function gradeAttempt(attemptId: string) {
  const attempt = await prisma.cBTAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: true,
      questions: {
        include: { question: { include: { options: { orderBy: { order: "asc" } } } } },
        orderBy: { order: "asc" },
      },
      answers: true,
    },
  });
  if (!attempt || attempt.status === "GRADED") return attempt;

  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let hasManualPending = false;
  let autoScore = 0;
  const totalPossible = attempt.questions.reduce((sum, q) => sum + q.marks, 0);

  await prisma.$transaction(async (tx) => {
    for (const aq of attempt.questions) {
      const question = aq.question as unknown as QuestionForGrading;
      const existing = answerByQuestion.get(aq.questionId);
      const response = existing?.response ?? null;

      if (!AUTO_GRADABLE_TYPES.includes(question.type)) {
        hasManualPending = true;
        await tx.cBTAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: aq.questionId } },
          create: { attemptId, questionId: aq.questionId, response: response ?? undefined, gradingStatus: "NEEDS_MANUAL_GRADING" },
          update: { gradingStatus: "NEEDS_MANUAL_GRADING" },
        });
        continue;
      }

      const graded =
        question.type === "MATCHING"
          ? gradeMatchingAnswer(question.options, (aq.optionOrder as string[] | null) ?? [], response, aq.marks)
          : gradeObjectiveAnswer(question, response, attempt.exam.negativeMarkingEnabled, attempt.exam.negativeMarkPerWrong, aq.marks);

      autoScore += graded.marksAwarded;
      await tx.cBTAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: aq.questionId } },
        create: {
          attemptId,
          questionId: aq.questionId,
          response: response ?? undefined,
          isCorrect: graded.isCorrect,
          marksAwarded: graded.marksAwarded,
          gradingStatus: graded.gradingStatus,
        },
        update: { isCorrect: graded.isCorrect, marksAwarded: graded.marksAwarded, gradingStatus: graded.gradingStatus },
      });
    }

    if (!hasManualPending) {
      await finalizeAttemptScore(tx, attempt.id, attempt.examId, attempt.studentId, attempt.isPractice, autoScore, totalPossible);
    }
  });

  if (hasManualPending) {
    await notifyCbtManualGradingRequired(attempt.schoolId, attempt.examId, attempt.exam.title);
  }

  return prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attemptId } });
}

/// Called once every answer is settled (no auto-grading left pending
/// and, via finalizeIfFullyGraded, no manual grading left pending
/// either) — computes the final score/percentage, marks the attempt
/// GRADED, and only then decides whether it becomes THIS exam's official
/// result for the student (see promoteOfficialAttempt) and whether that
/// promotion should write to the gradebook.
async function finalizeAttemptScore(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  attemptId: string,
  examId: string,
  studentId: string,
  isPractice: boolean,
  rawScore: number,
  totalPossible: number
) {
  const score = Math.max(0, rawScore);
  const percentage = totalPossible > 0 ? Math.round((score / totalPossible) * 10000) / 100 : 0;

  await tx.cBTAttempt.update({ where: { id: attemptId }, data: { status: "GRADED", score, percentage } });

  if (isPractice) return;
  await promoteOfficialAttempt(tx, examId, studentId, attemptId, score);
}

/// "Best attempt counts": the highest-scoring GRADED attempt for this
/// exam/student becomes the one whose score represents the student
/// (isOfficialResult) — the deliberate no-separate-CBTResult-model design
/// (see the CBT schema section) means this flag IS the result record.
/// Only a promotion (a new official attempt, or a strictly higher score)
/// touches the gradebook; a lower-scoring retake never overwrites a
/// better already-recorded Score.
async function promoteOfficialAttempt(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  examId: string,
  studentId: string,
  attemptId: string,
  score: number
) {
  const currentOfficial = await tx.cBTAttempt.findFirst({ where: { examId, studentId, isOfficialResult: true } });
  if (currentOfficial && currentOfficial.id === attemptId) return;
  if (currentOfficial && (currentOfficial.score ?? -Infinity) >= score) return;

  if (currentOfficial) {
    await tx.cBTAttempt.update({ where: { id: currentOfficial.id }, data: { isOfficialResult: false } });
  }
  await tx.cBTAttempt.update({ where: { id: attemptId }, data: { isOfficialResult: true } });

  const exam = await tx.cBTExam.findUniqueOrThrow({ where: { id: examId } });
  if (!exam.assessmentComponentId) return;

  await saveScores(exam.schoolId, exam.createdById, {
    subjectId: exam.subjectId,
    termId: exam.termId,
    entries: [{ studentId, componentId: exam.assessmentComponentId, value: Math.round(score) }],
  });

  await notifyCbtResultAvailable(exam.schoolId, studentId, exam.title);
}

export interface GradingQueueFilters {
  examId?: string;
}

/// One row per (attempt, ESSAY question) still awaiting a human — the
/// manual-grading queue's whole source of truth. Ordered oldest-submitted
/// first so a grader naturally works through a FIFO backlog.
export async function listGradingQueue(schoolId: string, filters: GradingQueueFilters = {}) {
  return prisma.cBTAnswer.findMany({
    where: {
      gradingStatus: "NEEDS_MANUAL_GRADING",
      attempt: {
        schoolId,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        ...(filters.examId ? { examId: filters.examId } : {}),
      },
    },
    include: {
      question: { select: { prompt: true, marks: true, rubric: true, topic: true } },
      attempt: { include: { exam: { select: { id: true, title: true } }, student: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
    },
    orderBy: { answeredAt: "asc" },
  });
}

export async function getAnswerForGrading(schoolId: string, answerId: string) {
  return prisma.cBTAnswer.findFirst({
    where: { id: answerId, attempt: { schoolId } },
    include: {
      question: { select: { prompt: true, marks: true, rubric: true } },
      attempt: { include: { exam: { select: { title: true } }, student: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
      manualGrade: true,
    },
  });
}

/// The human decision is always what's written — aiSuggested* (Phase 7)
/// is advisory only and never substituted in here, per spec section 31.
export async function gradeAnswer(schoolId: string, gradedById: string, answerId: string, marksAwarded: number, feedback: string | null) {
  const answer = await prisma.cBTAnswer.findFirst({
    where: { id: answerId, attempt: { schoolId } },
    include: { question: { select: { marks: true } }, attempt: true },
  });
  if (!answer) throw new Error("Answer not found.");
  if (marksAwarded < 0 || marksAwarded > answer.question.marks) {
    throw new Error(`Marks must be between 0 and ${answer.question.marks}.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.cBTManualGrade.upsert({
      where: { answerId },
      create: { answerId, marksAwarded, feedback, gradedById, gradedAt: new Date() },
      update: { marksAwarded, feedback, gradedById, gradedAt: new Date() },
    });
    await tx.cBTAnswer.update({ where: { id: answerId }, data: { marksAwarded, gradingStatus: "MANUALLY_GRADED" } });
  });

  await finalizeIfFullyGraded(answer.attemptId);
}

/// Recomputes and finalizes the attempt's score once nothing is left
/// pending (called after every manual grade, in case this was the last
/// one) — mirrors gradeAttempt's own finalize path so a partly-manual
/// attempt reaches GRADED exactly once, whichever answer settles last.
async function finalizeIfFullyGraded(attemptId: string) {
  const attempt = await prisma.cBTAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true, questions: true },
  });
  if (attempt.status === "GRADED") return;
  const stillPending = attempt.answers.some((a) => a.gradingStatus === "PENDING" || a.gradingStatus === "NEEDS_MANUAL_GRADING");
  if (stillPending) return;

  const totalPossible = attempt.questions.reduce((sum, q) => sum + q.marks, 0);
  const rawScore = attempt.answers.reduce((sum, a) => sum + (a.marksAwarded ?? 0), 0);

  await prisma.$transaction(async (tx) => {
    await finalizeAttemptScore(tx, attempt.id, attempt.examId, attempt.studentId, attempt.isPractice, rawScore, totalPossible);
  });
}
