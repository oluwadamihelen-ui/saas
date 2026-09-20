"use client";

import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { publishLectureAction, archiveLectureAction, unpublishLectureAction } from "../actions";

export function PublishButton({ lectureId }: { lectureId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button size="sm" disabled={isPending} onClick={() => run(() => publishLectureAction(lectureId))}>
      {isPending ? "Publishing..." : "Publish"}
    </Button>
  );
}

export function UnpublishButton({ lectureId }: { lectureId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => unpublishLectureAction(lectureId))}>
      {isPending ? "Moving..." : "Move to draft"}
    </Button>
  );
}

export function ArchiveButton({ lectureId }: { lectureId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        if (confirm("Archive this lecture? Students will no longer be able to see it.")) {
          run(() => archiveLectureAction(lectureId));
        }
      }}
    >
      {isPending ? "Archiving..." : "Archive"}
    </Button>
  );
}
