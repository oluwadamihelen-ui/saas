import "server-only";
import { prisma } from "@/lib/db";
import { gradeAttempt } from "@/lib/services/cbt-grading";
import { requireFeature } from "@/lib/billing/entitlements";
import type { CBTAttemptStatus, CBTDifficulty, CBTExamStatus, CBTQuestionType, Prisma } from "@/generated/prisma/client";

/// Fisher-Yates — used for randomizeQuestionOrder/randomizeOptionOrder and
/// for the MATCHING/ORDERING starting arrangement, which is ALWAYS
/// shuffled (see buildAttemptQuestions) regardless of those flags, since
/// showing either in authoring order would trivially reveal the answer.
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function listCandidateExamsForStudent(schoolId: string, studentId: string) {
  const candidates = await prisma.cBTExamCandidate.findMany({
    where: { schoolId, studentId },
    include: {
      exam: { include: { subject: true, examType: true, term: true } },
      attempts: { orderBy: { attemptNumber: "desc" } },
    },
    orderBy: { exam: { startAt: "desc" } },
  });

  const now = new Date();
  return Promise.all(
    candidates.map(async (c) => {
      let exam = c.exam;
      let nextStatus: CBTExamStatus | null = null;
      if (exam.status === "PUBLISHED" && exam.startAt <= now) nextStatus = "LIVE";
      else if ((exam.status === "PUBLISHED" || exam.status === "LIVE") && exam.endAt <= now) nextStatus = "ENDED";
      if (nextStatus) {
        exam = await prisma.cBTExam.update({
          where: { id: exam.id },
          data: { status: nextStatus },
          include: { subject: true, examType: true, term: true },
        });
      }
      return { candidate: c, exam, attempts: c.attempts };
    })
  );
}

export async function getExamForCandidate(schoolId: string, studentId: string, examId: string) {
  const candidate = await prisma.cBTExamCandidate.findFirst({
    where: { schoolId, studentId, examId },
    include: {
      exam: { include: { subject: true, examType: true, term: true } },
      attempts: { orderBy: { attemptNumber: "desc" } },
    },
  });
  return candidate;
}

/// deadlineAt is computed ONCE, here, at attempt creation — the sole
/// server-side source of truth for time remaining and the auto-submit
/// cutoff (schema doc-comment on CBTAttempt.deadlineAt). extraTimeMinutes
/// comes only from the CBTExamCandidate row a staff member set — never
/// from anything the client sends, so a student can never grant
/// themselves extra time (spec section 41).
export async function startAttempt(schoolId: string, studentId: string, examId: string) {
  await requireFeature(schoolId, "cbt");
  const candidate = await prisma.cBTExamCandidate.findFirst({
    where: { schoolId, studentId, examId },
    include: { exam: true },
  });
  if (!candidate) throw new Error("You are not assigned to this exam.");

  const now = new Date();
  let exam = candidate.exam;
  if (exam.status === "PUBLISHED" && exam.startAt <= now) {
    exam = await prisma.cBTExam.update({ where: { id: exam.id }, data: { status: "LIVE" } });
  } else if ((exam.status === "PUBLISHED" || exam.status === "LIVE") && exam.endAt <= now) {
    exam = await prisma.cBTExam.update({ where: { id: exam.id }, data: { status: "ENDED" } });
  }

  if (exam.status !== "LIVE") {
    throw new Error(
      exam.status === "ENDED" || exam.status === "COMPLETED" || exam.status === "GRADING"
        ? "This exam has closed."
        : "This exam is not open yet."
    );
  }

  // Idempotent: re-clicking Start while already mid-attempt resumes it
  // rather than creating a second one.
  const inProgress = await prisma.cBTAttempt.findFirst({
    where: { examId, studentId, status: "IN_PROGRESS" },
  });
  if (inProgress) return inProgress;

  const usedAttempts = await prisma.cBTAttempt.count({
    where: { examId, studentId, status: { not: "ABANDONED" } },
  });
  const maxAttempts = candidate.maxAttemptsOverride ?? exam.maxAttempts;
  if (usedAttempts >= maxAttempts) {
    throw new Error("You have used all your attempts for this exam.");
  }

  const deadlineAt = new Date(now.getTime() + (exam.durationMinutes + candidate.extraTimeMinutes) * 60_000);
  const attemptQuestions = await buildAttemptQuestions(schoolId, exam);

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.cBTAttempt.create({
      data: {
        schoolId,
        examId,
        candidateId: candidate.id,
        studentId,
        attemptNumber: usedAttempts + 1,
        status: "IN_PROGRESS",
        isPractice: exam.isPractice,
        startedAt: now,
        deadlineAt,
      },
    });

    await tx.cBTAttemptQuestion.createMany({
      data: attemptQuestions.map((q, i) => ({
        attemptId: attempt.id,
        questionId: q.questionId,
        order: i,
        marks: q.marks,
        optionOrder: q.optionOrder ?? undefined,
      })),
    });

    if (candidate.attendanceStatus === "PENDING") {
      await tx.cBTExamCandidate.update({ where: { id: candidate.id }, data: { attendanceStatus: "ATTEMPTED" } });
    }

    return attempt;
  });
}

interface AttemptQuestionPlan {
  questionId: string;
  marks: number;
  /// For MATCHING: an array of option ids giving the shuffled "pool"
  /// order (index -> which option's matchText is shown there). For
  /// ORDERING/randomized-option MCQ types: the shuffled option id order
  /// to render. Undefined for everything else.
  optionOrder?: string[];
}

async function buildAttemptQuestions(schoolId: string, exam: { id: string; subjectId: string; questionSelectionMode: string; randomizeQuestionOrder: boolean; randomizeOptionOrder: boolean }): Promise<AttemptQuestionPlan[]> {
  let questions: { id: string; type: CBTQuestionType; marks: number; marksOverride?: number | null; options: { id: string }[] }[];

  if (exam.questionSelectionMode === "MANUAL") {
    const examQuestions = await prisma.cBTExamQuestion.findMany({
      where: { examId: exam.id },
      include: { question: { include: { options: true } } },
      orderBy: { order: "asc" },
    });
    questions = examQuestions.map((eq) => ({
      id: eq.question.id,
      type: eq.question.type,
      marks: eq.marksOverride ?? eq.question.marks,
      options: eq.question.options,
    }));
  } else {
    const blueprint = await prisma.cBTExamBlueprint.findUnique({ where: { examId: exam.id }, include: { rules: true } });
    if (!blueprint) throw new Error("This exam has no blueprint configured.");

    const picked: typeof questions = [];
    const usedIds = new Set<string>();
    for (const rule of blueprint.rules) {
      const pool = await prisma.cBTQuestion.findMany({
        where: {
          schoolId,
          subjectId: exam.subjectId,
          status: "APPROVED",
          id: { notIn: [...usedIds] },
          ...(rule.topic ? { topic: rule.topic } : {}),
          ...(rule.difficulty ? { difficulty: rule.difficulty as CBTDifficulty } : {}),
        },
        include: { options: true },
      });
      const chosen = shuffle(pool).slice(0, rule.count);
      for (const q of chosen) {
        usedIds.add(q.id);
        picked.push({ id: q.id, type: q.type, marks: q.marks, options: q.options });
      }
    }
    questions = shuffle(picked);
  }

  if (exam.randomizeQuestionOrder) questions = shuffle(questions);

  return questions.map((q) => {
    const isOptionBased = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "MATCHING", "ORDERING"].includes(q.type);
    if (!isOptionBased) return { questionId: q.id, marks: q.marks };

    // MATCHING/ORDERING always shuffle their starting arrangement — the
    // stored/authoring order IS the answer key for these two types, so
    // never showing it unshuffled is the only thing that keeps it secret.
    const alwaysShuffle = q.type === "MATCHING" || q.type === "ORDERING";
    const optionOrder = exam.randomizeOptionOrder || alwaysShuffle ? shuffle(q.options.map((o) => o.id)) : undefined;
    return { questionId: q.id, marks: q.marks, optionOrder };
  });
}

/// The one place that decides "is this student still allowed to write to
/// this attempt right now" — auto-submits (lazily, on read, same pattern
/// as exam status reconciliation) the moment `deadlineAt` has passed,
/// server-side, regardless of what the client's own timer displayed.
/// Grading runs synchronously the moment that transition actually
/// happens (updated.count > 0 — never on a read that finds it already
/// AUTO_SUBMITTED from an earlier call, so this only fires once). Not
/// fire-and-forget: this app has no background job runner, so an
/// un-awaited promise here could be torn down with the request before it
/// finishes, exactly the class of bug this whole reconciliation pattern
/// exists to avoid.
async function reconcileAttemptExpiry(attempt: { id: string; status: CBTAttemptStatus; deadlineAt: Date }) {
  if (attempt.status !== "IN_PROGRESS" || attempt.deadlineAt > new Date()) return attempt;
  const updated = await prisma.cBTAttempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: { status: "AUTO_SUBMITTED", submittedAt: attempt.deadlineAt },
  });
  if (updated.count === 0) return prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  await gradeAttempt(attempt.id);
  return prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
}

/// Question payload is built with an explicit Prisma `select` (never
/// `include`) so the correct-answer fields (CBTQuestionOption.isCorrect,
/// CBTQuestion.acceptedAnswers/rubric/explanation) are structurally
/// impossible to leak into the response — they're never selected in the
/// first place, not merely omitted afterwards (spec section 48).
export async function getAttemptForTaking(schoolId: string, studentId: string, attemptId: string) {
  const attempt = await prisma.cBTAttempt.findFirst({
    where: { schoolId, studentId, id: attemptId },
    include: {
      exam: { select: { title: true, instructions: true, requireFullscreen: true, detectTabSwitch: true, restrictCopyPaste: true, restrictRightClick: true, desktopOnly: true, autoSubmitOnExpiry: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          questionId: true,
          order: true,
          marks: true,
          optionOrder: true,
          question: {
            select: {
              id: true,
              type: true,
              prompt: true,
              imageUrl: true,
              audioUrl: true,
              topic: true,
              options: { select: { id: true, text: true }, orderBy: { order: "asc" } },
            },
          },
        },
      },
      answers: { select: { questionId: true, response: true } },
    },
  });
  if (!attempt) return null;

  const reconciled = await reconcileAttemptExpiry(attempt);
  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a.response]));

  const questions = attempt.questions.map((aq) => {
    const optionOrder = aq.optionOrder as string[] | null;
    const optionsById = new Map(aq.question.options.map((o) => [o.id, o]));
    let options = aq.question.options;
    let matchPool: { index: number; text: string }[] | undefined;

    if (optionOrder) {
      const ordered = optionOrder.map((id) => optionsById.get(id)).filter((o): o is NonNullable<typeof o> => Boolean(o));
      if (aq.question.type === "MATCHING") {
        // Left items keep their natural order; the shuffled pool (right
        // side) is what optionOrder actually encodes here — students
        // never see which pool entry belongs to which left item.
        matchPool = ordered.map((o, i) => ({ index: i, text: o.text }));
        options = aq.question.options;
      } else {
        options = ordered;
      }
    }

    return {
      id: aq.questionId,
      type: aq.question.type,
      prompt: aq.question.prompt,
      imageUrl: aq.question.imageUrl,
      audioUrl: aq.question.audioUrl,
      marks: aq.marks,
      options: options.map((o) => ({ id: o.id, text: o.text })),
      matchPool,
      savedResponse: answerByQuestion.get(aq.questionId) ?? null,
    };
  });

  return {
    id: reconciled.id,
    status: reconciled.status,
    deadlineAt: attempt.deadlineAt,
    exam: attempt.exam,
    questions,
  };
}

export async function saveAnswer(
  schoolId: string,
  studentId: string,
  attemptId: string,
  questionId: string,
  response: Prisma.InputJsonValue
) {
  const attempt = await prisma.cBTAttempt.findFirst({ where: { schoolId, studentId, id: attemptId } });
  if (!attempt) throw new Error("Attempt not found.");

  const reconciled = await reconcileAttemptExpiry(attempt);
  if (reconciled.status !== "IN_PROGRESS") {
    throw new Error("Time is up — this attempt has already been submitted.");
  }

  const belongs = await prisma.cBTAttemptQuestion.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
  });
  if (!belongs) throw new Error("This question is not part of this attempt.");

  await prisma.cBTAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, response, answeredAt: new Date() },
    update: { response, answeredAt: new Date() },
  });
}

/// Idempotent by construction: a conditional UPDATE matching only
/// status='IN_PROGRESS' means a double-click (or a retried request after
/// a dropped response) that arrives twice matches zero rows the second
/// time and safely no-ops rather than erroring or double-processing
/// (spec section 47's "double-click must never create two submissions").
export async function submitAttempt(schoolId: string, studentId: string, attemptId: string) {
  const attempt = await prisma.cBTAttempt.findFirst({ where: { schoolId, studentId, id: attemptId } });
  if (!attempt) throw new Error("Attempt not found.");
  if (attempt.status !== "IN_PROGRESS") return attempt; // already submitted — treat as success, not an error

  const now = new Date();
  const submittedAt = now > attempt.deadlineAt ? attempt.deadlineAt : now;
  // Conditional on status again here (not just the read above) is what
  // makes this idempotent under a real race — two concurrent submits
  // only ever let one UPDATE actually match, and only that one goes on
  // to grade.
  const result = await prisma.cBTAttempt.updateMany({
    where: { id: attemptId, status: "IN_PROGRESS" },
    data: { status: "SUBMITTED", submittedAt },
  });
  if (result.count > 0) await gradeAttempt(attemptId);
  return prisma.cBTAttempt.findUniqueOrThrow({ where: { id: attemptId } });
}
