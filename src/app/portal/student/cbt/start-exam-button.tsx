"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { startAttemptAction } from "./actions";

export function StartExamButton({ examId, label }: { examId: string; label: string }) {
  const [isPending, run] = useSafeAction();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <Button
        disabled={isPending}
        onClick={() =>
          run(async () => {
            setError(null);
            const result = await startAttemptAction(examId);
            if (result.status === "error") {
              setError(result.message ?? "Could not start the exam.");
              return;
            }
            router.push(`/portal/student/cbt/${examId}/attempt/${result.attemptId}`);
          })
        }
      >
        {isPending ? "Starting..." : label}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
