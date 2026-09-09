import "server-only";
import { prisma } from "@/lib/db";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { getExamAnalytics, getExamResultForStudent } from "@/lib/services/cbt-results";
import type { CBTDifficulty } from "@/generated/prisma/client";

export function isCbtAiConfigured(): boolean {
  return getAiProvider() !== null;
}

/// Extracts a JSON value from a model's raw text reply — strips a
/// ```json ... ``` fence if the model wrapped its answer in one despite
/// being told not to, since that's a common enough deviation to guard
/// against rather than fail on.
function parseJsonResponse<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    throw new Error("The AI response wasn't valid JSON. Try again.");
  }
}

// ---------------------------------------------------------------------
// AI question generation — always lands in AI_PENDING_REVIEW, never
// usable in an exam until a teacher explicitly approves it (spec
// sections 6-7). Scoped to the four question types a flat JSON schema
// can express unambiguously, same deliberate scoping the CSV importer
// (cbt-questions.ts) uses for its own supported-type subset.
// ---------------------------------------------------------------------

export const GENERATABLE_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] as const;
export type GeneratableQuestionType = (typeof GENERATABLE_TYPES)[number];

export interface GenerateQuestionsInput {
  subjectId: string;
  type: GeneratableQuestionType;
  topic: string;
  difficulty: CBTDifficulty;
  count: number;
}

interface AiQuestionDraft {
  prompt: string;
  marks: number;
  explanation?: string;
  options?: { text: string; isCorrect: boolean }[];
  acceptedAnswers?: string[];
  rubric?: string;
}

const QUESTION_GENERATION_SYSTEM_PROMPT = `You write exam questions for a school's computer-based testing system. \
Respond with ONLY a JSON object of the shape {"questions": [...]} — no prose, no markdown fences. \
Each item in "questions" must have: "prompt" (string), "marks" (integer 1-10), "explanation" (string, shown to \
students after grading). \
For MULTIPLE_CHOICE and TRUE_FALSE also include "options": an array of {"text": string, "isCorrect": boolean} \
— exactly one option must have isCorrect: true, and TRUE_FALSE must have exactly two options ("True"/"False"). \
For SHORT_ANSWER also include "acceptedAnswers": an array of 1-3 acceptable text answers. \
For ESSAY also include "rubric": a short string describing what a full-marks answer should cover — no options \
or acceptedAnswers for ESSAY. \
Write age-appropriate, curriculum-relevant, unambiguous questions with no more than one clearly correct answer.`;

function validateDraft(type: GeneratableQuestionType, draft: AiQuestionDraft): string | null {
  if (!draft.prompt?.trim()) return "missing prompt";
  if (!Number.isInteger(draft.marks) || draft.marks < 1) return "invalid marks";
  if (type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") {
    if (!Array.isArray(draft.options) || draft.options.length < 2) return "missing options";
    const correctCount = draft.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) return "must have exactly one correct option";
    if (type === "TRUE_FALSE" && draft.options.length !== 2) return "TRUE_FALSE must have exactly two options";
  } else if (type === "SHORT_ANSWER") {
    if (!Array.isArray(draft.acceptedAnswers) || draft.acceptedAnswers.length === 0) return "missing acceptedAnswers";
  }
  return null;
}

export interface GeneratedQuestionsResult {
  created: number;
  skipped: { prompt: string; reason: string }[];
}

/// One-shot, conversation-agnostic call to the provider — deliberately
/// bypasses the chat/AiConversation machinery (that exists for the
/// multi-turn assistant, not needed here) and, unlike a "write" AI tool
/// call in the assistant, needs no separate PROPOSED/confirm step of its
/// own: the CBTQuestion rows it writes are already inert (AI_PENDING_REVIEW
/// can never be selected into an exam) until a human approves each one
/// individually on the review screen, which the caller must still reach
/// through the same UI flow.
export async function generateQuestionsWithAI(
  schoolId: string,
  createdById: string,
  input: GenerateQuestionsInput
): Promise<GeneratedQuestionsResult> {
  const provider = getAiProvider();
  if (!provider) throw new Error("AI question generation isn't configured for this deployment.");

  const subject = await prisma.subject.findFirst({ where: { schoolId, id: input.subjectId } });
  if (!subject) throw new Error("Subject not found.");

  const userPrompt = `Subject: ${subject.name}\nTopic: ${input.topic}\nQuestion type: ${input.type}\nDifficulty: ${input.difficulty}\nGenerate exactly ${input.count} question(s).`;

  const result = await provider.generate({
    systemPrompt: QUESTION_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [],
  });
  if (result.type !== "text") throw new Error("Unexpected AI response format.");

  const parsed = parseJsonResponse<{ questions: AiQuestionDraft[] }>(result.text);
  const drafts = Array.isArray(parsed.questions) ? parsed.questions : [];
  if (drafts.length === 0) throw new Error("The AI didn't return any questions. Try again.");

  const skipped: { prompt: string; reason: string }[] = [];
  let created = 0;

  for (const draft of drafts) {
    const problem = validateDraft(input.type, draft);
    if (problem) {
      skipped.push({ prompt: draft.prompt ?? "(missing prompt)", reason: problem });
      continue;
    }

    await prisma.cBTQuestion.create({
      data: {
        schoolId,
        subjectId: input.subjectId,
        type: input.type,
        status: "AI_PENDING_REVIEW",
        source: "AI_GENERATED",
        difficulty: input.difficulty,
        topic: input.topic,
        prompt: draft.prompt,
        marks: draft.marks,
        explanation: draft.explanation || null,
        acceptedAnswers: draft.acceptedAnswers?.length ? draft.acceptedAnswers : undefined,
        rubric: draft.rubric || null,
        createdById,
        options:
          draft.options && draft.options.length
            ? { create: draft.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i })) }
            : undefined,
      },
    });
    created++;
  }

  return { created, skipped };
}

// ---------------------------------------------------------------------
// AI exam insights — read-only narrative over Phase 6's own analytics;
// never mutates anything, so there's nothing here that needs a
// review/approval step the way generated questions do.
// ---------------------------------------------------------------------

const INSIGHTS_SYSTEM_PROMPT = `You are analyzing computer-based exam results for a teacher. You'll be given \
aggregate statistics only — never any individual student's name or personal data. Write a short (3-5 sentence) \
plain-text summary: call out the weakest question(s)/topics by facility (% correct), how the class performed \
overall relative to the total marks, and one concrete, actionable suggestion for what to revisit in class. \
No markdown, no headings, just prose. If there isn't enough graded data yet, say so plainly instead of guessing.`;

export async function generateExamInsights(schoolId: string, examId: string): Promise<string> {
  const provider = getAiProvider();
  if (!provider) throw new Error("AI insights aren't configured for this deployment.");

  const analytics = await getExamAnalytics(schoolId, examId);
  if (!analytics) throw new Error("Exam not found.");

  const summary = {
    gradedCount: analytics.gradedCount,
    candidateCount: analytics.candidateCount,
    average: analytics.average,
    highest: analytics.highest,
    lowest: analytics.lowest,
    totalMarks: analytics.totalMarks,
    questions: analytics.questionStats.map((q) => ({ prompt: q.prompt, type: q.type, facility: q.facility, averageMarks: q.averageMarks })),
  };

  const result = await provider.generate({
    systemPrompt: INSIGHTS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(summary) }],
    tools: [],
  });
  if (result.type !== "text") throw new Error("Unexpected AI response format.");
  return result.text.trim();
}

// ---------------------------------------------------------------------
// AI personalized revision plan + remedial practice questions — built
// from a student's OWN graded result only (never another student's
// data). Remedial practice items are shown to that one student inline as
// self-study material with their answer already revealed — they are
// NOT written into CBTQuestion, so they never enter the shared question
// bank and never need the AI-question-review step above (that step
// exists to protect what could become real exam content; a private
// study aid one student sees once isn't that).
// ---------------------------------------------------------------------

const REVISION_PLAN_SYSTEM_PROMPT = `You are a supportive tutor helping a student revise after a graded exam. \
You'll be given their own question-by-question result (which they got right/wrong, and the topic of each \
question). Respond with ONLY a JSON object: {"plan": string, "practiceQuestions": [{"prompt": string, "answer": \
string, "explanation": string}]}. "plan" is a short (3-5 sentence), encouraging, concrete study plan focused on \
the topics they got wrong. "practiceQuestions" is 2-4 short practice questions (with the answer given) targeting \
those same weak topics — these are for self-study only, not a real exam. If they got everything right, say so \
warmly in "plan" and still offer 1-2 stretch questions.`;

export interface RevisionPlanResult {
  plan: string;
  practiceQuestions: { prompt: string; answer: string; explanation: string }[];
}

export async function generateRevisionPlan(schoolId: string, studentId: string, examId: string): Promise<RevisionPlanResult> {
  const provider = getAiProvider();
  if (!provider) throw new Error("AI revision plans aren't configured for this deployment.");

  const result = await getExamResultForStudent(schoolId, studentId, examId);
  if (!result || result.status !== "visible" || !result.questions) {
    throw new Error("Your result isn't available yet.");
  }

  const breakdown = result.questions.map((q) => ({ topic: q.prompt, isCorrect: q.isCorrect, marksAwarded: q.marksAwarded, marks: q.marks }));

  const aiResult = await provider.generate({
    systemPrompt: REVISION_PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify({ score: result.score, totalMarks: result.totalMarks, breakdown }) }],
    tools: [],
  });
  if (aiResult.type !== "text") throw new Error("Unexpected AI response format.");

  const parsed = parseJsonResponse<RevisionPlanResult>(aiResult.text);
  return {
    plan: parsed.plan ?? "",
    practiceQuestions: Array.isArray(parsed.practiceQuestions) ? parsed.practiceQuestions.slice(0, 4) : [],
  };
}

// ---------------------------------------------------------------------
// AI grading suggestion — advisory only for the manual-grading queue.
// Returned to the grader for them to look at; nothing here ever writes
// to CBTManualGrade. The human's own marksAwarded/feedback in
// gradeAnswer() (cbt-grading.ts) is what actually counts, exactly per
// the schema's own doc comment on CBTManualGrade.aiSuggestedMarks (spec
// section 31: "AI must never silently finalize subjective marks").
// ---------------------------------------------------------------------

const GRADING_SUGGESTION_SYSTEM_PROMPT = `You are helping a teacher grade one student's answer to an essay or \
short-answer exam question. Respond with ONLY a JSON object: {"suggestedMarks": number, "feedback": string}. \
"suggestedMarks" is your suggested mark out of the maximum given, based on the rubric if one is provided. \
"feedback" is 1-3 sentences of constructive feedback for the student. This is only a suggestion for the \
teacher to review — be honest about weaknesses in the answer rather than generous.`;

export interface GradingSuggestion {
  suggestedMarks: number;
  feedback: string;
}

export async function suggestGrade(schoolId: string, answerId: string): Promise<GradingSuggestion> {
  const provider = getAiProvider();
  if (!provider) throw new Error("AI grading suggestions aren't configured for this deployment.");

  const answer = await prisma.cBTAnswer.findFirst({
    where: { id: answerId, attempt: { schoolId } },
    include: { question: { select: { prompt: true, marks: true, rubric: true } } },
  });
  if (!answer) throw new Error("Answer not found.");

  const response = typeof answer.response === "string" ? answer.response : JSON.stringify(answer.response ?? "");
  const userPrompt = JSON.stringify({
    question: answer.question.prompt,
    maxMarks: answer.question.marks,
    rubric: answer.question.rubric,
    studentAnswer: response,
  });

  const result = await provider.generate({ systemPrompt: GRADING_SUGGESTION_SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt }], tools: [] });
  if (result.type !== "text") throw new Error("Unexpected AI response format.");

  const parsed = parseJsonResponse<GradingSuggestion>(result.text);
  const clampedMarks = Math.max(0, Math.min(answer.question.marks, Number(parsed.suggestedMarks) || 0));
  return { suggestedMarks: clampedMarks, feedback: parsed.feedback ?? "" };
}
