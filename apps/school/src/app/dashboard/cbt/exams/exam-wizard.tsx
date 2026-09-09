"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  createExamAction,
  updateExamAction,
  createExamTypeAction,
  fetchSubjectQuestionsAction,
  type ExamPayload,
} from "./actions";
import type { CBTDifficulty, CBTQuestionType } from "@/generated/prisma/client";

const STEPS = [
  "Basics",
  "Questions",
  "Scheduling",
  "Randomization & grading",
  "Security",
  "Results",
  "Candidates",
  "Review",
];

interface QuestionOption {
  id: string;
  prompt: string;
  type: CBTQuestionType;
  difficulty: CBTDifficulty;
  marks: number;
  topic: string | null;
}

export interface ExamWizardInitial {
  title: string;
  examTypeId: string;
  subjectId: string;
  termId: string;
  assessmentComponentId: string | null;
  instructions: string | null;
  isPractice: boolean;
  questionSelectionMode: "MANUAL" | "BLUEPRINT";
  selectedQuestions: QuestionOption[];
  blueprintTotalQuestions: number;
  blueprintRules: { topic: string | null; difficulty: CBTDifficulty | null; count: number }[];
  randomizeQuestionOrder: boolean;
  randomizeOptionOrder: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkPerWrong: number;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  requireFullscreen: boolean;
  detectTabSwitch: boolean;
  restrictCopyPaste: boolean;
  restrictRightClick: boolean;
  maxAttempts: number;
  autoSubmitOnExpiry: boolean;
  desktopOnly: boolean;
  resultVisibility: "IMMEDIATE" | "AFTER_GRADING" | "MANUAL_RELEASE";
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  showRanking: boolean;
  classArmIds: string[];
}

export function ExamWizard({
  mode,
  examId,
  examTypes: initialExamTypes,
  subjects,
  terms,
  assessmentComponents,
  classArms,
  initial,
}: {
  mode: "create" | "edit";
  examId?: string;
  examTypes: { id: string; label: string }[];
  subjects: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  assessmentComponents: { id: string; name: string }[];
  classArms: { id: string; name: string; activeStudentCount: number }[];
  initial?: ExamWizardInitial;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examTypes, setExamTypes] = useState(initialExamTypes);
  const [newTypeName, setNewTypeName] = useState("");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [examTypeId, setExamTypeId] = useState(initial?.examTypeId ?? examTypes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [termId, setTermId] = useState(initial?.termId ?? "");
  const [assessmentComponentId, setAssessmentComponentId] = useState(initial?.assessmentComponentId ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [isPractice, setIsPractice] = useState(initial?.isPractice ?? false);

  const [mode2, setMode2] = useState<"MANUAL" | "BLUEPRINT">(initial?.questionSelectionMode ?? "MANUAL");
  const [availableQuestions, setAvailableQuestions] = useState<QuestionOption[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionOption[]>(initial?.selectedQuestions ?? []);
  const [questionSearch, setQuestionSearch] = useState("");
  const [blueprintTotalQuestions, setBlueprintTotalQuestions] = useState(initial?.blueprintTotalQuestions ?? 10);
  const [blueprintRules, setBlueprintRules] = useState(
    initial?.blueprintRules ?? [{ topic: "", difficulty: null as CBTDifficulty | null, count: 10 }]
  );

  const [randomizeQuestionOrder, setRandomizeQuestionOrder] = useState(initial?.randomizeQuestionOrder ?? false);
  const [randomizeOptionOrder, setRandomizeOptionOrder] = useState(initial?.randomizeOptionOrder ?? false);
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState(initial?.negativeMarkingEnabled ?? false);
  const [negativeMarkPerWrong, setNegativeMarkPerWrong] = useState(initial?.negativeMarkPerWrong ?? 0.25);

  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 60);
  const [maxAttempts, setMaxAttempts] = useState(initial?.maxAttempts ?? 1);

  const [requireFullscreen, setRequireFullscreen] = useState(initial?.requireFullscreen ?? false);
  const [detectTabSwitch, setDetectTabSwitch] = useState(initial?.detectTabSwitch ?? true);
  const [restrictCopyPaste, setRestrictCopyPaste] = useState(initial?.restrictCopyPaste ?? false);
  const [restrictRightClick, setRestrictRightClick] = useState(initial?.restrictRightClick ?? false);
  const [autoSubmitOnExpiry, setAutoSubmitOnExpiry] = useState(initial?.autoSubmitOnExpiry ?? true);
  const [desktopOnly, setDesktopOnly] = useState(initial?.desktopOnly ?? false);

  const [resultVisibility, setResultVisibility] = useState<"IMMEDIATE" | "AFTER_GRADING" | "MANUAL_RELEASE">(
    initial?.resultVisibility ?? "AFTER_GRADING"
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(initial?.showCorrectAnswers ?? false);
  const [showExplanations, setShowExplanations] = useState(initial?.showExplanations ?? false);
  const [showRanking, setShowRanking] = useState(initial?.showRanking ?? false);

  const [classArmIds, setClassArmIds] = useState<string[]>(initial?.classArmIds ?? []);

  useEffect(() => {
    if (!subjectId || mode2 !== "MANUAL") return;
    fetchSubjectQuestionsAction(subjectId).then((qs) => setAvailableQuestions(qs));
  }, [subjectId, mode2]);

  const totalMarks = useMemo(() => selectedQuestions.reduce((sum, q) => sum + q.marks, 0), [selectedQuestions]);
  const blueprintRuleSum = useMemo(() => blueprintRules.reduce((sum, r) => sum + (r.count || 0), 0), [blueprintRules]);
  const totalCandidates = useMemo(
    () => classArms.filter((a) => classArmIds.includes(a.id)).reduce((sum, a) => sum + a.activeStudentCount, 0),
    [classArms, classArmIds]
  );

  const filteredAvailable = availableQuestions.filter(
    (q) => !selectedQuestions.some((s) => s.id === q.id) && q.prompt.toLowerCase().includes(questionSearch.toLowerCase())
  );

  function addQuestion(q: QuestionOption) {
    setSelectedQuestions((prev) => [...prev, q]);
  }
  function removeQuestion(id: string) {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));
  }
  function moveQuestion(index: number, dir: -1 | 1) {
    setSelectedQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleAddType() {
    if (!newTypeName.trim()) return;
    const result = await createExamTypeAction(newTypeName.trim());
    if ("status" in result) {
      setError(result.message);
      return;
    }
    setExamTypes((prev) => [...prev, result]);
    setExamTypeId(result.id);
    setNewTypeName("");
  }

  function buildPayload(): ExamPayload {
    return {
      title,
      examTypeId,
      subjectId,
      termId,
      assessmentComponentId: assessmentComponentId || null,
      instructions: instructions || null,
      isPractice,
      questionSelectionMode: mode2,
      questionIds: selectedQuestions.map((q) => q.id),
      blueprintTotalQuestions: mode2 === "BLUEPRINT" ? blueprintTotalQuestions : null,
      blueprintRules: mode2 === "BLUEPRINT" ? blueprintRules.map((r) => ({ topic: r.topic || null, difficulty: r.difficulty, count: r.count })) : [],
      randomizeQuestionOrder,
      randomizeOptionOrder,
      negativeMarkingEnabled,
      negativeMarkPerWrong,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      durationMinutes,
      requireFullscreen,
      detectTabSwitch,
      restrictCopyPaste,
      restrictRightClick,
      maxAttempts,
      autoSubmitOnExpiry,
      desktopOnly,
      resultVisibility,
      showCorrectAnswers,
      showExplanations,
      showRanking,
      classArmIds,
    };
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const payload = buildPayload();
    const result = mode === "edit" && examId ? await updateExamAction(examId, payload) : await createExamAction(payload);
    setSubmitting(false);
    if (result.status === "error") {
      setError(result.message ?? "Something went wrong.");
      return;
    }
    router.push(`/dashboard/cbt/exams/${result.examId}`);
  }

  function canProceed(): boolean {
    if (step === 0) return Boolean(title.trim() && examTypeId && subjectId && termId);
    if (step === 1) return mode2 === "MANUAL" ? selectedQuestions.length > 0 : blueprintRuleSum === blueprintTotalQuestions && blueprintRuleSum > 0;
    if (step === 2) return Boolean(startAt && endAt && durationMinutes > 0);
    if (step === 6) return true;
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              i === step ? "bg-accent text-accent-foreground" : i < step ? "bg-accent-soft text-accent" : "bg-muted-surface text-muted"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-5 pt-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Exam title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JSS2 Mathematics Mid-Term Test" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="examTypeId">Exam type</Label>
                  <Select id="examTypeId" value={examTypeId} onChange={(e) => setExamTypeId(e.target.value)}>
                    <option value="" disabled>Select type</option>
                    {examTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </Select>
                  <div className="flex gap-2 pt-1">
                    <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="Add custom type" className="h-8 text-xs" />
                    <Button type="button" size="sm" variant="ghost" onClick={handleAddType}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subjectId">Subject</Label>
                  <Select id="subjectId" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="" disabled>Select subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="termId">Term</Label>
                  <Select id="termId" value={termId} onChange={(e) => setTermId(e.target.value)}>
                    <option value="" disabled>Select term</option>
                    {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instructions">Instructions for students (optional)</Label>
                <Textarea id="instructions" rows={3} value={instructions ?? ""} onChange={(e) => setInstructions(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={isPractice} onChange={(e) => setIsPractice(e.target.checked)} />
                This is a practice exam (results never post to the gradebook)
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={mode2 === "MANUAL" ? "primary" : "outline"} onClick={() => setMode2("MANUAL")}>
                  Pick questions manually
                </Button>
                <Button type="button" size="sm" variant={mode2 === "BLUEPRINT" ? "primary" : "outline"} onClick={() => setMode2("BLUEPRINT")}>
                  Random selection (blueprint)
                </Button>
              </div>

              {mode2 === "MANUAL" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Available questions {!subjectId && "(select a subject first)"}</Label>
                    <Input placeholder="Search..." value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} />
                    <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {filteredAvailable.length === 0 && <p className="p-2 text-xs text-muted">No questions available.</p>}
                      {filteredAvailable.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => addQuestion(q)}
                          className="flex w-full items-start justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-muted-surface"
                        >
                          <span className="line-clamp-2">{q.prompt}</span>
                          <Badge variant="neutral">{q.marks}m</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Selected ({selectedQuestions.length}) — {totalMarks} total marks</Label>
                    <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                      {selectedQuestions.length === 0 && <p className="p-2 text-xs text-muted">No questions selected yet.</p>}
                      {selectedQuestions.map((q, i) => (
                        <div key={q.id} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm">
                          <span className="line-clamp-2 flex-1">{i + 1}. {q.prompt}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" size="sm" variant="ghost" onClick={() => moveQuestion(i, -1)} aria-label="Move up">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => moveQuestion(i, 1)} aria-label="Move down">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(q.id)} aria-label="Remove">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-48 space-y-1.5">
                    <Label htmlFor="blueprintTotal">Total questions per attempt</Label>
                    <Input
                      id="blueprintTotal"
                      type="number"
                      min={1}
                      value={blueprintTotalQuestions}
                      onChange={(e) => setBlueprintTotalQuestions(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Rules — how many questions to pull from each bucket</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setBlueprintRules((prev) => [...prev, { topic: "", difficulty: null, count: 5 }])}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add rule
                      </Button>
                    </div>
                    {blueprintRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          placeholder="Topic (optional)"
                          value={rule.topic ?? ""}
                          onChange={(e) =>
                            setBlueprintRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, topic: e.target.value } : r)))
                          }
                          className="flex-1"
                        />
                        <Select
                          value={rule.difficulty ?? ""}
                          onChange={(e) =>
                            setBlueprintRules((prev) =>
                              prev.map((r, idx) => (idx === i ? { ...r, difficulty: (e.target.value || null) as CBTDifficulty | null } : r))
                            )
                          }
                          className="w-36"
                        >
                          <option value="">Any difficulty</option>
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          value={rule.count}
                          onChange={(e) =>
                            setBlueprintRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, count: Number(e.target.value) } : r)))
                          }
                          className="w-24"
                        />
                        {blueprintRules.length > 1 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setBlueprintRules((prev) => prev.filter((_, idx) => idx !== i))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className={`text-xs ${blueprintRuleSum === blueprintTotalQuestions ? "text-muted" : "text-danger"}`}>
                      Rule counts add up to {blueprintRuleSum} of {blueprintTotalQuestions} required.
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    Actual questions are randomly selected per student when their attempt starts, matching this distribution.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startAt">Opens at</Label>
                <Input id="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endAt">Closes at</Label>
                <Input id="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input id="durationMinutes" type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxAttempts">Max attempts per student</Label>
                <Input id="maxAttempts" type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={randomizeQuestionOrder} onChange={(e) => setRandomizeQuestionOrder(e.target.checked)} />
                Randomize question order per student
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={randomizeOptionOrder} onChange={(e) => setRandomizeOptionOrder(e.target.checked)} />
                Randomize option order per student
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={negativeMarkingEnabled} onChange={(e) => setNegativeMarkingEnabled(e.target.checked)} />
                Enable negative marking (off by default)
              </label>
              {negativeMarkingEnabled && (
                <div className="w-56 space-y-1.5 pl-6">
                  <Label htmlFor="negMark">Marks deducted per wrong answer</Label>
                  <Input
                    id="negMark"
                    type="number"
                    min={0}
                    step={0.25}
                    value={negativeMarkPerWrong}
                    onChange={(e) => setNegativeMarkPerWrong(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-muted">
                These controls make casual cheating harder but are not foolproof. Anything flagged is logged as a security event for
                staff to review — students are never automatically accused based on these signals alone.
              </p>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={requireFullscreen} onChange={(e) => setRequireFullscreen(e.target.checked)} />
                Require fullscreen mode
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={detectTabSwitch} onChange={(e) => setDetectTabSwitch(e.target.checked)} />
                Detect and log tab switching
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={restrictCopyPaste} onChange={(e) => setRestrictCopyPaste(e.target.checked)} />
                Restrict copy/paste
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={restrictRightClick} onChange={(e) => setRestrictRightClick(e.target.checked)} />
                Restrict right-click
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={autoSubmitOnExpiry} onChange={(e) => setAutoSubmitOnExpiry(e.target.checked)} />
                Auto-submit when time expires
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={desktopOnly} onChange={(e) => setDesktopOnly(e.target.checked)} />
                Desktop/laptop only (block mobile devices)
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="resultVisibility">When can students see their result?</Label>
                <Select id="resultVisibility" value={resultVisibility} onChange={(e) => setResultVisibility(e.target.value as typeof resultVisibility)}>
                  <option value="IMMEDIATE">Immediately after submitting</option>
                  <option value="AFTER_GRADING">After grading is complete</option>
                  <option value="MANUAL_RELEASE">Only when manually released</option>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={showCorrectAnswers} onChange={(e) => setShowCorrectAnswers(e.target.checked)} />
                Show correct answers with the result
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={showExplanations} onChange={(e) => setShowExplanations(e.target.checked)} />
                Show explanations with the result
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={showRanking} onChange={(e) => setShowRanking(e.target.checked)} />
                Show class ranking
              </label>
              {!isPractice && (
                <div className="space-y-1.5">
                  <Label htmlFor="assessmentComponentId">Post the score to (gradebook component, optional)</Label>
                  <Select id="assessmentComponentId" value={assessmentComponentId} onChange={(e) => setAssessmentComponentId(e.target.value)}>
                    <option value="">Don&apos;t post to gradebook</option>
                    {assessmentComponents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <Label>Which classes are sitting this exam?</Label>
              <p className="text-xs text-muted">Currently-active students in the selected classes become candidates.</p>
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {classArms.map((arm) => (
                  <label key={arm.id} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-muted-surface">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={classArmIds.includes(arm.id)}
                        onChange={(e) =>
                          setClassArmIds((prev) => (e.target.checked ? [...prev, arm.id] : prev.filter((id) => id !== arm.id)))
                        }
                      />
                      {arm.name}
                    </span>
                    <span className="text-xs text-muted">{arm.activeStudentCount} students</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-foreground">{totalCandidates} student{totalCandidates === 1 ? "" : "s"} will be assigned.</p>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted">Title:</span> {title || "—"}</p>
              <p><span className="text-muted">Subject:</span> {subjects.find((s) => s.id === subjectId)?.name ?? "—"}</p>
              <p><span className="text-muted">Term:</span> {terms.find((t) => t.id === termId)?.name ?? "—"}</p>
              <p>
                <span className="text-muted">Questions:</span>{" "}
                {mode2 === "MANUAL" ? `${selectedQuestions.length} selected, ${totalMarks} total marks` : `${blueprintTotalQuestions} randomly selected per attempt`}
              </p>
              <p><span className="text-muted">Window:</span> {startAt || "—"} to {endAt || "—"} ({durationMinutes} min, {maxAttempts} attempt{maxAttempts === 1 ? "" : "s"})</p>
              <p><span className="text-muted">Candidates:</span> {totalCandidates} students across {classArmIds.length} class{classArmIds.length === 1 ? "" : "es"}</p>
              <p className="text-xs text-muted">
                This saves the exam as a draft. Review it, then publish it separately when you&apos;re ready for students to see it.
              </p>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : mode === "edit" ? "Save changes" : "Create exam (draft)"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {step < 7 && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button type="button" disabled={!canProceed()} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Next
          </Button>
        </div>
      )}
      {step === 7 && (
        <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
      )}
    </div>
  );
}
