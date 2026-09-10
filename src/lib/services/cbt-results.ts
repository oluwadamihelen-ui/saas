import "server-only";
import { prisma } from "@/lib/db";
import type { CBTAttemptStatus, CBTExam, CBTQuestionType } from "@/generated/prisma/client";

/// "Fully graded" means every attempt anyone actually started for this
/// exam has reached GRADED — a candidate who never attempted at all
/// (still PENDING attendance, no CBTAttempt row) never blocks it, but a
/// SUBMITTED/AUTO_SUBMITTED attempt still waiting on a manual grade does.
async function isExamFullyGraded(schoolId: string, examId: string): Promise<boolean> {
  const pending = await prisma.cBTAttempt.count({
    where: { schoolId, examId, status: { in: ["IN_PROGRESS", "SUBMITTED", "AUTO_SUBMITTED"] } },
  });
  return pending === 0;
}

/// The per-exam result-visibility gate (spec section 25): IMMEDIATE shows
/// a student their own result the moment their own attempt is GRADED;
/// AFTER_GRADING withholds it from everyone until the whole exam's
/// grading is done (so an early finisher can never see — or leak — the
/// answer key while classmates are still sitting the exam); MANUAL_RELEASE
/// withholds it until a teacher explicitly flips resultsReleasedAt.
function isResultVisible(
  exam: Pick<CBTExam, "resultVisibility" | "resultsReleasedAt">,
  attemptStatus: CBTAttemptStatus,
  examFullyGraded: boolean
): boolean {
  if (attemptStatus !== "GRADED") return false;
  switch (exam.resultVisibility) {
    case "IMMEDIATE":
      return true;
    case "AFTER_GRADING":
      return examFullyGraded;
    case "MANUAL_RELEASE":
      return exam.resultsReleasedAt !== null;
  }
}

/// Only meaningful once results are already visible to the student — this
/// is never consulted as part of the answer-key-protection boundary Phase
/// 4 built, since by definition the exam is over and grading is done.
function describeCorrectAnswer(question: {
  type: CBTQuestionType;
  acceptedAnswers: unknown;
  options: { id: string; text: string; matchText: string | null; isCorrect: boolean; order: number }[];
}): unknown {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "MULTIPLE_SELECT":
    case "TRUE_FALSE":
      return question.options.filter((o) => o.isCorrect).map((o) => o.text);
    case "SHORT_ANSWER":
    case "FILL_IN_BLANK":
      return Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
    case "ORDERING":
      return [...question.options].sort((a, b) => a.order - b.order).map((o) => o.text);
    case "MATCHING":
      return question.options.map((o) => `${o.text} → ${o.matchText}`);
    default:
      return null;
  }
}

export interface StudentExamResult {
  status: "no-attempt" | "pending-grading" | "pending-release" | "visible";
  score?: number | null;
  percentage?: number | null;
  totalMarks?: number;
  rank?: number;
  totalRanked?: number;
  questions?: {
    id: string;
    prompt: string;
    type: CBTQuestionType;
    marks: number;
    marksAwarded: number;
    isCorrect: boolean | null;
    response: unknown;
    correctAnswer?: unknown;
    explanation?: string | null;
    feedback?: string | null;
  }[];
}

export async function getExamResultForStudent(schoolId: string, studentId: string, examId: string): Promise<StudentExamResult | null> {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) return null;

  // A practice attempt never becomes isOfficialResult (finalizeAttemptScore
  // returns before that promotion for isPractice exams, by design — a
  // retake must never touch the gradebook). So "which attempt is this
  // student's result" means something different for a practice exam: the
  // most recent GRADED attempt, the same way a fresh retake naturally
  // supersedes the last one, rather than the single best-scoring attempt a
  // real exam tracks.
  const attempt = await prisma.cBTAttempt.findFirst({
    where: exam.isPractice ? { schoolId, studentId, examId, status: "GRADED" } : { schoolId, studentId, examId, isOfficialResult: true },
    orderBy: exam.isPractice ? { attemptNumber: "desc" } : undefined,
    include: {
      questions: { include: { question: { include: { options: { orderBy: { order: "asc" } } } } }, orderBy: { order: "asc" } },
      answers: { include: { manualGrade: true } },
    },
  });
  if (!attempt) return { status: "no-attempt" };

  const fullyGraded = await isExamFullyGraded(schoolId, examId);
  if (!isResultVisible(exam, attempt.status, fullyGraded)) {
    // "pending-release" only when the sole thing being waited on is a
    // teacher's explicit release — an ungraded attempt (this student's
    // own, or a classmate's under AFTER_GRADING) is "pending-grading"
    // either way.
    const pendingRelease = exam.resultVisibility === "MANUAL_RELEASE" && attempt.status === "GRADED";
    return { status: pendingRelease ? "pending-release" : "pending-grading" };
  }

  let rank: number | undefined;
  let totalRanked: number | undefined;
  if (exam.showRanking) {
    const ranked = await prisma.cBTAttempt.findMany({
      where: { schoolId, examId, isOfficialResult: true, status: "GRADED" },
      orderBy: { score: "desc" },
      select: { studentId: true },
    });
    rank = ranked.findIndex((a) => a.studentId === studentId) + 1;
    totalRanked = ranked.length;
  }

  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const totalMarks = attempt.questions.reduce((sum, q) => sum + q.marks, 0);

  const questions = attempt.questions.map((aq) => {
    const answer = answerByQuestion.get(aq.questionId);
    return {
      id: aq.questionId,
      prompt: aq.question.prompt,
      type: aq.question.type,
      marks: aq.marks,
      marksAwarded: answer?.marksAwarded ?? 0,
      isCorrect: answer?.isCorrect ?? null,
      response: answer?.response ?? null,
      correctAnswer: exam.showCorrectAnswers ? describeCorrectAnswer(aq.question) : undefined,
      explanation: exam.showExplanations ? aq.question.explanation : undefined,
      feedback: answer?.manualGrade?.feedback ?? null,
    };
  });

  return { status: "visible", score: attempt.score, percentage: attempt.percentage, totalMarks, rank, totalRanked, questions };
}

/// The one explicit publish-like action for MANUAL_RELEASE exams —
/// resultsReleasedAt otherwise stays null forever, so results are simply
/// never shown regardless of how long ago grading finished.
export async function releaseExamResults(schoolId: string, examId: string) {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id: examId } });
  if (!exam) throw new Error("Exam not found.");
  if (exam.resultVisibility !== "MANUAL_RELEASE") {
    throw new Error("This exam isn't configured for manual result release.");
  }
  return prisma.cBTExam.update({ where: { id: examId }, data: { resultsReleasedAt: new Date() } });
}

export interface ExamAnalytics {
  candidateCount: number;
  attemptedCount: number;
  gradedCount: number;
  pendingManualCount: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  totalMarks: number;
  fullyGraded: boolean;
  resultsReleasedAt: Date | null;
  students: {
    studentId: string;
    name: string;
    admissionNumber: string;
    status: CBTAttemptStatus;
    score: number | null;
    percentage: number | null;
    attemptNumber: number;
  }[];
  questionStats: {
    questionId: string;
    prompt: string;
    type: CBTQuestionType;
    marks: number;
    gradedResponses: number;
    correctCount: number;
    facility: number | null;
    averageMarks: number | null;
  }[];
}

/// Scoped to official attempts only — a retake that was never promoted
/// (see cbt-grading.ts's promoteOfficialAttempt) never counts twice
/// toward these stats, same as it never counts twice toward the
/// gradebook.
export async function getExamAnalytics(schoolId: string, examId: string): Promise<ExamAnalytics | null> {
  const exam = await prisma.cBTExam.findFirst({ where: { schoolId, id: examId }, include: { candidates: true } });
  if (!exam) return null;

  const attempts = await prisma.cBTAttempt.findMany({
    where: { schoolId, examId, isOfficialResult: true },
    include: {
      student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      questions: true,
    },
    orderBy: { score: "desc" },
  });

  const graded = attempts.filter((a) => a.status === "GRADED");
  const scores = graded.map((a) => a.score ?? 0);
  const totalMarks = attempts[0]?.questions.reduce((sum, q) => sum + q.marks, 0) ?? exam.totalMarks;

  const answers = await prisma.cBTAnswer.findMany({
    where: { attempt: { schoolId, examId, isOfficialResult: true, status: "GRADED" } },
    include: { question: { select: { id: true, prompt: true, type: true } } },
  });
  const byQuestion = new Map<string, { prompt: string; type: CBTQuestionType; marks: number; correct: number; total: number; marksSum: number }>();
  for (const a of answers) {
    const aq = attempts.flatMap((at) => at.questions).find((q) => q.questionId === a.questionId);
    const key = a.questionId;
    const entry = byQuestion.get(key) ?? { prompt: a.question.prompt, type: a.question.type, marks: aq?.marks ?? 0, correct: 0, total: 0, marksSum: 0 };
    entry.total += 1;
    if (a.isCorrect) entry.correct += 1;
    entry.marksSum += a.marksAwarded ?? 0;
    byQuestion.set(key, entry);
  }

  return {
    candidateCount: exam.candidates.length,
    attemptedCount: attempts.length,
    gradedCount: graded.length,
    pendingManualCount: attempts.filter((a) => a.status === "SUBMITTED" || a.status === "AUTO_SUBMITTED").length,
    average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
    totalMarks,
    fullyGraded: await isExamFullyGraded(schoolId, examId),
    resultsReleasedAt: exam.resultsReleasedAt,
    students: attempts.map((a) => ({
      studentId: a.studentId,
      name: `${a.student.firstName} ${a.student.lastName}`,
      admissionNumber: a.student.admissionNumber,
      status: a.status,
      score: a.score,
      percentage: a.percentage,
      attemptNumber: a.attemptNumber,
    })),
    questionStats: [...byQuestion.entries()].map(([questionId, v]) => ({
      questionId,
      prompt: v.prompt,
      type: v.type,
      marks: v.marks,
      gradedResponses: v.total,
      correctCount: v.correct,
      facility: v.type === "ESSAY" ? null : v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : null,
      averageMarks: v.total > 0 ? Math.round((v.marksSum / v.total) * 100) / 100 : null,
    })),
  };
}
