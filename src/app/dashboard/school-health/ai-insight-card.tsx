"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateSchoolHealthInsightAction, type GenerateSchoolHealthInsightState } from "./ai-insight-actions";

const initialState: GenerateSchoolHealthInsightState = { status: "idle" };

/// Only rendered when an AI provider is configured for this deployment
/// (checked server-side by the page — isSchoolHealthAiConfigured()).
/// Generation is on-demand, not automatic — every section above this
/// card is already complete and useful with zero AI involvement; this is
/// a strictly optional narrative layer over already-verified numbers.
export function AiInsightCard({ termId }: { termId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: GenerateSchoolHealthInsightState) => generateSchoolHealthInsightAction(termId),
    initialState
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Executive Insight</CardTitle>
        <CardDescription>A readable summary of the metrics above, generated from these same verified numbers — never a separate judgment of its own.</CardDescription>
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

        {state.status === "success" && state.insight && (
          <div className="space-y-4 text-sm">
            <p className="text-foreground">{state.insight.summary}</p>

            {state.insight.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Strengths</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {state.insight.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {state.insight.concerns.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Concerns</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {state.insight.concerns.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            {state.insight.suggestedActions.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Suggested actions</p>
                <p className="text-xs text-muted">For school leadership to consider — not automatic or required.</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
                  {state.insight.suggestedActions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
