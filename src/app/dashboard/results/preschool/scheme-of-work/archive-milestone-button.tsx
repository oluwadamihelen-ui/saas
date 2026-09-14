"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { archiveMilestoneAction, restoreMilestoneAction } from "../actions";

export function ArchiveMilestoneButton({ milestoneId, status }: { milestoneId: string; status: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  if (status === "ARCHIVED") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => run(async () => {
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
      onClick={() => run(async () => {
        await archiveMilestoneAction(milestoneId);
        router.refresh();
      })}
    >
      Archive
    </Button>
  );
}
