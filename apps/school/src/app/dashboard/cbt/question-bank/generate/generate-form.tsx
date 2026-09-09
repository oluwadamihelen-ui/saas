"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateQuestionsAction, type GenerateQuestionsState } from "../actions";

const initialState: GenerateQuestionsState = { status: "idle" };

export function GenerateForm({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(generateQuestionsAction, initialState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="subjectId">Subject</Label>
            <Select id="subjectId" name="subjectId" required defaultValue="">
              <option value="" disabled>Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Question type</Label>
            <Select id="type" name="type" defaultValue="MULTIPLE_CHOICE">
              <option value="MULTIPLE_CHOICE">Multiple choice</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short answer</option>
              <option value="ESSAY">Essay</option>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="topic">Topic</Label>
          <Input id="topic" name="topic" required placeholder="e.g. Photosynthesis, Fractions, The Nigerian Civil War" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select id="difficulty" name="difficulty" defaultValue="MEDIUM">
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="count">How many?</Label>
            <Input id="count" name="count" type="number" min={1} max={10} defaultValue={5} />
          </div>
        </div>
        <Button type="submit" disabled={isPending}>{isPending ? "Generating..." : "Generate questions"}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </form>

      {state.status === "done" && (
        <div className="space-y-3 rounded-md border border-border bg-muted-surface p-4 text-sm">
          <p className="font-medium text-foreground">
            Created {state.created} question{state.created === 1 ? "" : "s"}, pending your review.
          </p>
          {state.skipped && state.skipped.length > 0 && (
            <div className="space-y-1">
              <p className="text-muted">{state.skipped.length} skipped (invalid response from the AI):</p>
              <ul className="list-inside list-disc text-xs text-muted">
                {state.skipped.map((s, i) => <li key={i}>{s.prompt} — {s.reason}</li>)}
              </ul>
            </div>
          )}
          <Link href="/dashboard/cbt/question-bank?status=AI_PENDING_REVIEW" className="inline-block text-sm font-medium text-accent hover:underline">
            Review the generated questions <Badge variant="accent">{state.created}</Badge>
          </Link>
        </div>
      )}
    </div>
  );
}
