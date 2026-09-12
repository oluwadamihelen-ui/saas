"use client";

import { useActionState, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { gradeAnswerAction, getGradingSuggestionAction, type GradeAnswerState } from "../actions";
import type { GradingSuggestion } from "@/lib/services/cbt-ai";

const initialState: GradeAnswerState = { status: "idle" };

export function GradeForm({
  answerId,
  maxMarks,
  initialMarks,
  initialFeedback,
  aiConfigured,
}: {
  answerId: string;
  maxMarks: number;
  initialMarks?: number;
  initialFeedback?: string;
  aiConfigured: boolean;
}) {
  const action = gradeAnswerAction.bind(null, answerId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [marks, setMarks] = useState(initialMarks?.toString() ?? "");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [suggestion, setSuggestion] = useState<GradingSuggestion | null>(null);
  const [suggestPending, startSuggestTransition] = useTransition();
  const [suggestError, setSuggestError] = useState<string | null>(null);

  return (
    <form action={formAction} className="space-y-4">
      {aiConfigured && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          {!suggestion ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={suggestPending}
              onClick={() =>
                startSuggestTransition(async () => {
                  setSuggestError(null);
                  const result = await getGradingSuggestionAction(answerId);
                  if (result.status === "error") {
                    setSuggestError(result.message ?? "Could not get a suggestion.");
                    return;
                  }
                  setSuggestion(result.suggestion ?? null);
                })
              }
            >
              <Sparkles className="h-3.5 w-3.5" /> {suggestPending ? "Thinking..." : "Get AI suggestion"}
            </Button>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-muted">AI suggests <strong className="text-foreground">{suggestion.suggestedMarks} / {maxMarks}</strong> — {suggestion.feedback}</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMarks(String(suggestion.suggestedMarks));
                  setFeedback(suggestion.feedback);
                }}
              >
                Use this
              </Button>
            </div>
          )}
          {suggestError && <p className="text-xs text-danger">{suggestError}</p>}
          <p className="text-xs text-muted">Advisory only — you decide the final grade.</p>
        </div>
      )}

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
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feedback">Feedback (optional)</Label>
        <Textarea
          id="feedback"
          name="feedback"
          rows={4}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Shown to the student with their result"
        />
      </div>
      {suggestion && (
        <>
          <input type="hidden" name="aiSuggestedMarks" value={suggestion.suggestedMarks} />
          <input type="hidden" name="aiSuggestedFeedback" value={suggestion.feedback} />
        </>
      )}
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save grade"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
