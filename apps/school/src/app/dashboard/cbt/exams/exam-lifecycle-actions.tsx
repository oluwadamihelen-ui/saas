"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishExamAction, unpublishExamAction, archiveExamAction, deleteExamAction } from "./actions";
import type { CBTExamStatus } from "@/generated/prisma/client";

export function ExamLifecycleActions({
  examId,
  status,
  canPublish,
  canEdit,
}: {
  examId: string;
  status: CBTExamStatus;
  canPublish: boolean;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(action: () => Promise<{ status: "ok" | "error"; message?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && canPublish && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => publishExamAction(examId))}>
            Publish
          </Button>
        )}
        {status === "PUBLISHED" && canPublish && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => unpublishExamAction(examId))}>
            Unpublish
          </Button>
        )}
        {status === "DRAFT" && canEdit && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => router.push(`/dashboard/cbt/exams/${examId}/edit`)}>
            Edit
          </Button>
        )}
        {status !== "LIVE" && status !== "ARCHIVED" && canEdit && (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => archiveExamAction(examId))}>
            Archive
          </Button>
        )}
        {status === "DRAFT" && canEdit && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Permanently delete this draft exam? This cannot be undone.")) return;
              run(() => deleteExamAction(examId), () => router.push("/dashboard/cbt/exams"));
            }}
          >
            Delete
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
