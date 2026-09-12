"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ensureSchemeOfWorkAction } from "../actions";

export function StartSchemeButton({
  academicSessionId,
  termId,
  classGroupId,
  subjectId,
}: {
  academicSessionId: string;
  termId: string;
  classGroupId: string;
  subjectId: string;
}) {
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
            try {
              await ensureSchemeOfWorkAction({ academicSessionId, termId, classGroupId, subjectId });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create Scheme of Work.");
            }
          })
        }
      >
        {isPending ? "Creating..." : "Create Scheme of Work"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
