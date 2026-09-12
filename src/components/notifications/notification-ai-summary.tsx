"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { generateNotificationsAiSummaryAction, type NotificationsAiSummaryResult } from "@/lib/actions/notifications";

/// Only renders the trigger — no AI call happens until the user explicitly
/// clicks it (brief section 37: never call AI automatically/for every
/// notification). aiConfigured is passed from the server so an
/// unconfigured deployment doesn't even show a button that would just
/// error — the rest of the notification center stays fully usable either
/// way.
export function NotificationAiSummary({ aiConfigured }: { aiConfigured: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<NotificationsAiSummaryResult | null>(null);

  if (!aiConfigured) return null;

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateNotificationsAiSummaryAction();
      setResult(res);
    });
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isPending} className="inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" />
        {isPending ? "Summarizing…" : "Summarize with AI"}
      </Button>
      {result && (
        <Card>
          <CardContent className="space-y-2 py-4">
            {result.ok ? (
              result.summary ? (
                <>
                  <p className="text-sm text-foreground">{result.summary.summary}</p>
                  {result.summary.topPriorities.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                      {result.summary.topPriorities.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">Nothing needs your attention right now — no summary needed.</p>
              )
            ) : (
              <p className="text-sm text-muted">{result.error}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
