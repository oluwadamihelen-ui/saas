"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { archiveMilestoneAction, restoreMilestoneAction } from "../actions";

export function ArchiveMilestoneButton({ milestoneId, status }: { milestoneId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "ARCHIVED") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await restoreMilestoneAction(milestoneId);
          router.refresh();
        })}
      >
        Restore
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await archiveMilestoneAction(milestoneId);
        router.refresh();
      })}
    >
      Archive
    </Button>
  );
}
