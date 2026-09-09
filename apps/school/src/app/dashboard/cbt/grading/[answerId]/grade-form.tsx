"use client";

import { useActionState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { gradeAnswerAction, type GradeAnswerState } from "../actions";

const initialState: GradeAnswerState = { status: "idle" };

export function GradeForm({
  answerId,
  maxMarks,
  initialMarks,
  initialFeedback,
}: {
  answerId: string;
  maxMarks: number;
  initialMarks?: number;
  initialFeedback?: string;
}) {
  const action = gradeAnswerAction.bind(null, answerId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="marksAwarded">Marks (out of {maxMarks})</Label>
        <Input
          id="marksAwarded"
          name="marksAwarded"
          type="number"
          min={0}
          max={maxMarks}
          step={0.5}
          required
          defaultValue={initialMarks}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feedback">Feedback (optional)</Label>
        <Textarea id="feedback" name="feedback" rows={4} defaultValue={initialFeedback} placeholder="Shown to the student with their result" />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save grade"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
