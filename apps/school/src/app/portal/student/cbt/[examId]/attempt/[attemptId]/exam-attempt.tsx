"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { saveAnswerAction, submitAttemptAction } from "../../../actions";
import type { CBTQuestionType, Prisma } from "@/generated/prisma/client";

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AttemptQuestionView {
  id: string;
  type: CBTQuestionType;
  prompt: string;
  imageUrl: string | null;
  audioUrl: string | null;
  marks: number;
  options: { id: string; text: string }[];
  matchPool?: { index: number; text: string }[];
  savedResponse: unknown;
}

export function ExamAttempt({
  attemptId,
  examTitle,
  deadlineAt,
  questions,
  detectTabSwitch,
}: {
  attemptId: string;
  examTitle: string;
  deadlineAt: string;
  questions: AttemptQuestionView[];
  detectTabSwitch: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const map: Record<string, unknown> = {};
    for (const q of questions) {
      if (q.savedResponse !== null && q.savedResponse !== undefined) map[q.id] = q.savedResponse;
      else if (q.type === "ORDERING") map[q.id] = q.options.map((o) => o.id);
    }
    return map;
  });
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  // Set only from explicit async callbacks (an action's response, never a
  // bare effect body) when the server itself says time is up — a second,
  // independent signal alongside the client clock reaching zero, in case
  // of clock drift.
  const [serverSaysExpired, setServerSaysExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const autoSubmitTriggered = useRef(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const deadline = useMemo(() => new Date(deadlineAt).getTime(), [deadlineAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const msRemaining = deadline - now;
  const expired = serverSaysExpired || msRemaining <= 0;

  // Display-only countdown reconciled against the server-issued deadline —
  // the actual cutoff is enforced server-side on every save/submit call
  // regardless of what this shows.
  const clampedMs = Math.max(0, msRemaining);
  const minutes = Math.floor(clampedMs / 60_000);
  const seconds = Math.floor((clampedMs % 60_000) / 1000);
  const timeLow = clampedMs < 5 * 60_000;

  useEffect(() => {
    if (!detectTabSwitch) return;
    const handler = () => {
      // Phase 8 will turn this into a logged CBTSecurityEvent; for now
      // this is a no-op hook point so the flag's presence is at least
      // wired up end to end.
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [detectTabSwitch]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (submitted) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitted]);

  async function attemptSave(questionId: string, response: unknown, retriesLeft = 3, delay = 1000): Promise<void> {
    setSaveStatus((prev) => ({ ...prev, [questionId]: "saving" }));
    try {
      const result = await saveAnswerAction(attemptId, questionId, response as Prisma.InputJsonValue);
      if (result.status === "ok") {
        setSaveStatus((prev) => ({ ...prev, [questionId]: "saved" }));
        return;
      }
      if (result.message?.toLowerCase().includes("time is up")) {
        setServerSaysExpired(true);
        return;
      }
      throw new Error(result.message);
    } catch {
      if (retriesLeft > 0) {
        setSaveStatus((prev) => ({ ...prev, [questionId]: "pending" }));
        setTimeout(() => attemptSave(questionId, response, retriesLeft - 1, delay * 2), delay);
      } else {
        setSaveStatus((prev) => ({ ...prev, [questionId]: "error" }));
      }
    }
  }

  function queueSave(questionId: string, response: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    setSaveStatus((prev) => ({ ...prev, [questionId]: "pending" }));
    if (debounceTimers.current[questionId]) clearTimeout(debounceTimers.current[questionId]);
    debounceTimers.current[questionId] = setTimeout(() => attemptSave(questionId, response), 700);
  }

  async function handleSubmit() {
    if (!confirm("Submit this exam now? You won't be able to change your answers afterwards.")) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitAttemptAction(attemptId);
    setSubmitting(false);
    if (result.status === "error") {
      setSubmitError(result.message ?? "Could not submit.");
      return;
    }
    setSubmitted(true);
  }

  useEffect(() => {
    if (expired && !submitted && !submitting && !autoSubmitTriggered.current) {
      autoSubmitTriggered.current = true;
      submitAttemptAction(attemptId).then((result) => {
        if (result.status === "ok") setSubmitted(true);
      });
    }
  }, [expired, submitted, submitting, attemptId]);

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <Check className="mx-auto h-10 w-10 text-success" />
        <h1 className="text-xl font-semibold text-foreground">Exam submitted</h1>
        <p className="text-sm text-muted">&quot;{examTitle}&quot; has been submitted successfully.</p>
        <Button onClick={() => router.push("/portal/student/cbt")}>Back to exams</Button>
      </div>
    );
  }

  const question = questions[index];
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{examTitle}</p>
            <p className="text-xs text-muted">Question {index + 1} of {questions.length} · {question.marks} mark{question.marks === 1 ? "" : "s"}</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${timeLow ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`}>
            <Clock className="h-4 w-4" />
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>

        {expired && (
          <div className="flex items-center gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Time is up — submitting your exam now.
          </div>
        )}

        <div className="rounded-md border border-border bg-surface p-5">
          <p className="whitespace-pre-wrap text-base text-foreground">{question.prompt}</p>
          {question.imageUrl && <img src={question.imageUrl} alt="" className="mt-3 max-h-72 rounded-md" />}
          {question.audioUrl && <audio src={question.audioUrl} controls className="mt-3 w-full" />}

          <div className="mt-5">
            <QuestionInput
              question={question}
              value={answers[question.id]}
              disabled={expired || submitted}
              onChange={(v) => queueSave(question.id, v)}
            />
          </div>

          <SaveIndicator status={saveStatus[question.id]} onRetry={() => attemptSave(question.id, answers[question.id])} />
        </div>

        <div className="flex items-center justify-between">
          <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            Previous
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>
          ) : (
            <Button disabled={submitting || expired} onClick={handleSubmit}>
              {submitting ? "Submitting..." : "Submit exam"}
            </Button>
          )}
        </div>
        {submitError && <p className="text-sm text-danger">{submitError}</p>}
      </div>

      <div className="space-y-3">
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-medium text-muted">{answeredCount} of {questions.length} answered</p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => {
              const answered = isAnswered(answers[q.id]);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                    i === index
                      ? "bg-accent text-accent-foreground"
                      : answered
                        ? "bg-success-soft text-success"
                        : "bg-muted-surface text-muted"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <Button className="w-full" disabled={submitting || expired} onClick={handleSubmit}>
          {submitting ? "Submitting..." : "Submit exam"}
        </Button>
      </div>
    </div>
  );
}

function isAnswered(response: unknown): boolean {
  if (response === null || response === undefined) return false;
  if (Array.isArray(response)) return response.length > 0;
  if (typeof response === "object") return Object.keys(response).length > 0;
  return String(response).trim().length > 0;
}

function SaveIndicator({ status, onRetry }: { status?: SaveStatus; onRetry: () => void }) {
  if (!status || status === "idle") return null;
  if (status === "saving" || status === "pending") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
      </p>
    );
  }
  if (status === "saved") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
        <Check className="h-3 w-3" /> Saved
      </p>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-danger">
      <AlertTriangle className="h-3 w-3" /> Couldn&apos;t save — check your connection.
      <button type="button" onClick={onRetry} className="font-medium underline">
        Retry
      </button>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  disabled,
  onChange,
}: {
  question: AttemptQuestionView;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
      return (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm hover:bg-muted-surface">
              <input type="radio" name={question.id} disabled={disabled} checked={value === o.id} onChange={() => onChange(o.id)} />
              {o.text}
            </label>
          ))}
        </div>
      );
    case "MULTIPLE_SELECT": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm hover:bg-muted-surface">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))}
              />
              {o.text}
            </label>
          ))}
        </div>
      );
    }
    case "SHORT_ANSWER":
    case "FILL_IN_BLANK":
      return (
        <input
          type="text"
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer"
          className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
      );
    case "ESSAY":
      return (
        <Textarea
          disabled={disabled}
          rows={8}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your answer"
        />
      );
    case "MATCHING": {
      const responseMap = (value && typeof value === "object" ? value : {}) as Record<string, number>;
      return (
        <div className="space-y-2">
          {question.options.map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
              <span className="flex-1">{o.text}</span>
              <select
                disabled={disabled}
                value={responseMap[o.id] ?? ""}
                onChange={(e) => onChange({ ...responseMap, [o.id]: Number(e.target.value) })}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              >
                <option value="" disabled>Match...</option>
                {question.matchPool?.map((p) => (
                  <option key={p.index} value={p.index}>{p.text}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case "ORDERING": {
      const order = Array.isArray(value) ? (value as string[]) : question.options.map((o) => o.id);
      const optionsById = new Map(question.options.map((o) => [o.id, o]));
      function move(i: number, dir: -1 | 1) {
        const next = [...order];
        const target = i + dir;
        if (target < 0 || target >= next.length) return;
        [next[i], next[target]] = [next[target], next[i]];
        onChange(next);
      }
      return (
        <div className="space-y-2">
          {order.map((id, i) => (
            <div key={id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
              <span className="flex-1">{i + 1}. {optionsById.get(id)?.text}</span>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => move(i, -1)} aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => move(i, 1)} aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}
