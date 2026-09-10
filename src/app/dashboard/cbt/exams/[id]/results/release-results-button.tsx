"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { releaseExamResultsAction } from "../../actions";

export function ReleaseResultsButton({ examId }: { examId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await releaseExamResultsAction(examId);
            if (result.status === "error") {
              setError(result.message ?? "Could not release results.");
              return;
            }
            router.refresh();
          })
        }
      >
        {isPending ? "Releasing..." : "Release results to students"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
