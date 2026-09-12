"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateRevisionPlanAction } from "../../actions";
import type { RevisionPlanResult } from "@/lib/services/cbt-ai";

export function RevisionPlan({ examId, aiConfigured }: { examId: string; aiConfigured: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState<RevisionPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!aiConfigured) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Study help</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!plan ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await generateRevisionPlanAction(examId);
                if (result.status === "error") {
                  setError(result.message ?? "Could not generate a revision plan.");
                  return;
                }
                setPlan(result.plan ?? null);
              })
            }
          >
            {isPending ? "Thinking..." : "Get a personalized study plan"}
          </Button>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm text-foreground">{plan.plan}</p>
            {plan.practiceQuestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted">Practice questions</p>
                {plan.practiceQuestions.map((q, i) => (
                  <div key={i} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-foreground">{i + 1}. {q.prompt}</p>
                    <p className="mt-1 text-xs text-success">Answer: {q.answer}</p>
                    <p className="text-xs text-muted">{q.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
