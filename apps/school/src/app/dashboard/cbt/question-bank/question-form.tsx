"use client";

import { useActionState, useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { QuestionFormState } from "./actions";
import type { CBTQuestionType, CBTDifficulty } from "@/generated/prisma/client";

const TYPE_OPTIONS: { value: CBTQuestionType; label: string; hint: string }[] = [
  { value: "MULTIPLE_CHOICE", label: "Multiple choice", hint: "One correct option" },
  { value: "MULTIPLE_SELECT", label: "Multiple select", hint: "One or more correct options" },
  { value: "TRUE_FALSE", label: "True / False", hint: "Two options, one correct" },
  { value: "SHORT_ANSWER", label: "Short answer", hint: "Accepted text answers, auto-graded" },
  { value: "FILL_IN_BLANK", label: "Fill in the blank", hint: "Accepted text answers, auto-graded" },
  { value: "ESSAY", label: "Essay", hint: "Manually graded, optional rubric" },
  { value: "MATCHING", label: "Matching", hint: "Match each item to its pair" },
  { value: "ORDERING", label: "Ordering", hint: "Arrange items in the correct order" },
];

const OPTION_TYPES = new Set<CBTQuestionType>(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "TRUE_FALSE", "MATCHING", "ORDERING"]);
const SINGLE_CORRECT_TYPES = new Set<CBTQuestionType>(["MULTIPLE_CHOICE", "TRUE_FALSE"]);
const TEXT_ANSWER_TYPES = new Set<CBTQuestionType>(["SHORT_ANSWER", "FILL_IN_BLANK"]);

export interface QuestionOptionSeed {
  text: string;
  matchText?: string | null;
  isCorrect: boolean;
}

export interface QuestionFormInitial {
  subjectId?: string;
  classGroupId?: string | null;
  type?: CBTQuestionType;
  difficulty?: CBTDifficulty;
  topic?: string | null;
  subtopic?: string | null;
  learningObjective?: string | null;
  prompt?: string;
  marks?: number;
  explanation?: string | null;
  rubric?: string | null;
  acceptedAnswers?: string[] | null;
  options?: QuestionOptionSeed[];
  tagNames?: string[];
}

export function QuestionForm({
  action,
  submitLabel,
  subjects,
  classGroups,
  initial,
}: {
  action: (state: QuestionFormState, formData: FormData) => Promise<QuestionFormState>;
  submitLabel: string;
  subjects: { id: string; name: string }[];
  classGroups: { id: string; name: string }[];
  initial?: QuestionFormInitial;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as QuestionFormState);
  const [type, setType] = useState<CBTQuestionType>(initial?.type ?? "MULTIPLE_CHOICE");
  const [options, setOptions] = useState<QuestionOptionSeed[]>(
    initial?.options && initial.options.length > 0
      ? initial.options
      : type === "TRUE_FALSE"
        ? [{ text: "True", isCorrect: false }, { text: "False", isCorrect: false }]
        : [{ text: "", isCorrect: false }, { text: "", isCorrect: false }]
  );

  function handleTypeChange(next: CBTQuestionType) {
    setType(next);
    if (next === "TRUE_FALSE" && options.length !== 2) {
      setOptions([{ text: "True", isCorrect: false }, { text: "False", isCorrect: false }]);
    }
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOption(index: number, patch: Partial<QuestionOptionSeed>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function toggleCorrect(index: number) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i !== index) return SINGLE_CORRECT_TYPES.has(type) ? { ...o, isCorrect: false } : o;
        return { ...o, isCorrect: !o.isCorrect };
      })
    );
  }

  const showOptions = OPTION_TYPES.has(type);
  const showAcceptedAnswers = TEXT_ANSWER_TYPES.has(type);
  const showRubric = type === "ESSAY";

  return (
    <form action={formAction} className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="subjectId">Subject</Label>
          <Select id="subjectId" name="subjectId" required defaultValue={initial?.subjectId ?? ""}>
            <option value="" disabled>Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="classGroupId">Class (optional)</Label>
          <Select id="classGroupId" name="classGroupId" defaultValue={initial?.classGroupId ?? ""}>
            <option value="">Any class</option>
            {classGroups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Question type</Label>
          <Select id="type" name="type" value={type} onChange={(e) => handleTypeChange(e.target.value as CBTQuestionType)}>
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <p className="text-xs text-muted">{TYPE_OPTIONS.find((t) => t.value === type)?.hint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select id="difficulty" name="difficulty" defaultValue={initial?.difficulty ?? "MEDIUM"}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="marks">Marks</Label>
          <Input id="marks" name="marks" type="number" min={1} max={100} required defaultValue={initial?.marks ?? 1} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="topic">Topic (optional)</Label>
          <Input id="topic" name="topic" defaultValue={initial?.topic ?? ""} placeholder="e.g. Fractions" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subtopic">Subtopic (optional)</Label>
          <Input id="subtopic" name="subtopic" defaultValue={initial?.subtopic ?? ""} placeholder="e.g. Adding fractions" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prompt">Question prompt</Label>
        <Textarea id="prompt" name="prompt" required rows={3} defaultValue={initial?.prompt ?? ""} placeholder="What is 1/2 + 1/4?" />
      </div>

      {showOptions && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            {type !== "TRUE_FALSE" && (
              <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                <Plus className="h-3.5 w-3.5" /> Add option
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                {type !== "MATCHING" && type !== "ORDERING" && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type={SINGLE_CORRECT_TYPES.has(type) ? "radio" : "checkbox"}
                      name="optionCorrect"
                      value={String(i)}
                      checked={option.isCorrect}
                      onChange={() => toggleCorrect(i)}
                      aria-label={`Option ${i + 1} is correct`}
                    />
                    Correct
                  </label>
                )}
                <Input
                  name="optionText"
                  value={option.text}
                  onChange={(e) => updateOption(i, { text: e.target.value })}
                  placeholder={type === "TRUE_FALSE" ? undefined : `Option ${i + 1}`}
                  readOnly={type === "TRUE_FALSE"}
                  required
                  className="flex-1"
                />
                {type === "MATCHING" && (
                  <Input
                    name="optionMatch"
                    value={option.matchText ?? ""}
                    onChange={(e) => updateOption(i, { matchText: e.target.value })}
                    placeholder="Matches with..."
                    required
                    className="flex-1"
                  />
                )}
                {type !== "TRUE_FALSE" && options.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(i)} aria-label="Remove option">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {type === "ORDERING" && (
            <p className="text-xs text-muted">Options above should be listed in their correct order — the order they&apos;re shown here is the answer key.</p>
          )}
        </div>
      )}

      {showAcceptedAnswers && (
        <div className="space-y-1.5">
          <Label htmlFor="acceptedAnswers">Accepted answers</Label>
          <Textarea
            id="acceptedAnswers"
            name="acceptedAnswers"
            rows={2}
            defaultValue={initial?.acceptedAnswers?.join(", ") ?? ""}
            placeholder="Separate accepted answers with commas, e.g. Lagos, lagos state"
          />
          <p className="text-xs text-muted">The student&apos;s answer is auto-graded correct if it matches any of these (case-insensitive).</p>
        </div>
      )}

      {showRubric && (
        <div className="space-y-1.5">
          <Label htmlFor="rubric">Grading rubric (optional)</Label>
          <Textarea id="rubric" name="rubric" rows={3} defaultValue={initial?.rubric ?? ""} placeholder="Guidance for the teacher grading this essay..." />
          <p className="text-xs text-muted">Essay answers always go to manual grading — this is just guidance shown to the grader.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="explanation">Explanation (optional)</Label>
        <Textarea id="explanation" name="explanation" rows={2} defaultValue={initial?.explanation ?? ""} placeholder="Shown to students after results are released" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags">Tags (optional)</Label>
        <Input id="tags" name="tags" defaultValue={initial?.tagNames?.join(", ") ?? ""} placeholder="Separate tags with commas" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : submitLabel}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
