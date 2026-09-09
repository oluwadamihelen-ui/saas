"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { archiveQuestionAction, restoreQuestionAction, deleteQuestionAction } from "./actions";

export function QuestionRowActions({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "ARCHIVED") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await restoreQuestionAction(id);
          router.refresh();
        })}
      >
        Restore
      </Button>
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
            startTransition(async () => {
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
        onClick={() => startTransition(async () => {
          await archiveQuestionAction(id);
          router.refresh();
        })}
      >
        Archive
      </Button>
    </div>
  );
}
