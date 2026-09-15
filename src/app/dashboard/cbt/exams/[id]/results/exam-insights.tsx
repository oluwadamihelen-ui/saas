"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSafeAction } from "@/hooks/use-safe-action";
import { generateExamInsightsAction } from "./actions";

export function ExamInsights({ examId, aiConfigured }: { examId: string; aiConfigured: boolean }) {
  const [isPending, run] = useSafeAction();
  const [insights, setInsights] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!aiConfigured) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{insights}</p>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                setError(null);
                const result = await generateExamInsightsAction(examId);
                if (result.status === "error") {
                  setError(result.message ?? "Could not generate insights.");
                  return;
                }
                setInsights(result.insights ?? null);
              })
            }
          >
            {isPending ? "Analyzing..." : "Get AI insights"}
          </Button>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
