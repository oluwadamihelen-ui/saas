"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateTranscriptAction } from "./actions";

export function GenerateButton({ studentId, hasExisting }: { studentId: string; hasExisting: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={hasExisting ? "secondary" : "primary"}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await generateTranscriptAction(studentId);
            setError(result.error);
            if (!result.error) router.refresh();
          })
        }
      >
        {isPending ? "Generating..." : hasExisting ? "Regenerate transcript" : "Generate transcript"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
