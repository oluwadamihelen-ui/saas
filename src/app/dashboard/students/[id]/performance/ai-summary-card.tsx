"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateAiSummaryAction, type GenerateAiSummaryState } from "./ai-summary-actions";

const initialState: GenerateAiSummaryState = { status: "idle" };

/// Only rendered when an AI provider is actually configured for this
/// deployment (checked server-side by the page — see
/// isPerformanceAiConfigured()) — otherwise this card doesn't exist at
/// all rather than showing a permanently-broken button. Generation is
/// on-demand (a button, not automatic on page load) since it's a real,
/// metered API call — the deterministic analysis above this card is
/// already complete and useful with zero AI involvement.
export function AiSummaryCard({ studentId, termId }: { studentId: string; termId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: GenerateAiSummaryState) => generateAiSummaryAction(studentId, termId),
    initialState
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI insight</CardTitle>
        <CardDescription>
          A readable summary of the analysis above, generated from these same verified numbers — never a separate
          judgment of its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status !== "success" && (
          <form action={formAction}>
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? "Generating..." : "Generate AI insight"}
            </Button>
            {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
          </form>
        )}

        {state.status === "success" && state.summary && (
          <div className="space-y-4 text-sm">
            <p className="text-foreground">{state.summary.summary}</p>

            {state.summary.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Strengths</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {state.summary.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {state.summary.concerns.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Concerns</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {state.summary.concerns.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            {state.summary.suggestedActions.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Suggested actions</p>
                <p className="text-xs text-muted">For a teacher or administrator to consider — not automatic or required.</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {state.summary.suggestedActions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
