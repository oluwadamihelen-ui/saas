"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { revokeTranscriptAction } from "./actions";

export function RevokeButton({ transcriptId, studentId }: { transcriptId: string; studentId: string }) {
  const [isPending, run] = useSafeAction();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => {
          const reason = window.prompt("Revoke this transcript? It stays on record but will fail verification. Optional reason:");
          if (reason === null) return;
          run(async () => {
            const result = await revokeTranscriptAction(transcriptId, studentId, reason);
            setError(result.error);
            if (!result.error) router.refresh();
          });
        }}
      >
        {isPending ? "Revoking..." : "Revoke"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
