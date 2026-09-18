"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { archiveQuestionAction, restoreQuestionAction, deleteQuestionAction, approveQuestionAction } from "./actions";

export function QuestionRowActions({ id, status }: { id: string; status: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  if (status === "ARCHIVED") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => run(async () => {
          await restoreQuestionAction(id);
          router.refresh();
        })}
      >
        Restore
      </Button>
    );
  }

  if (status === "AI_PENDING_REVIEW") {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => run(async () => {
            await approveQuestionAction(id);
            router.refresh();
          })}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Reject and permanently delete this AI-generated question?")) return;
            run(async () => {
              await deleteQuestionAction(id);
              router.refresh();
            });
          }}
        >
          Reject
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {status === "DRAFT" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Permanently delete this draft question? This cannot be undone.")) return;
            run(async () => {
              await deleteQuestionAction(id);
              router.refresh();
            });
          }}
        >
          Delete
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => run(async () => {
          await archiveQuestionAction(id);
          router.refresh();
        })}
      >
        Archive
      </Button>
    </div>
  );
}
