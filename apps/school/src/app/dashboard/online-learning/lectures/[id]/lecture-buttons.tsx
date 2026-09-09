"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishLectureAction, archiveLectureAction, unpublishLectureAction } from "../actions";

export function PublishButton({ lectureId }: { lectureId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button size="sm" disabled={isPending} onClick={() => startTransition(() => publishLectureAction(lectureId))}>
      {isPending ? "Publishing..." : "Publish"}
    </Button>
  );
}

export function UnpublishButton({ lectureId }: { lectureId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={isPending} onClick={() => startTransition(() => unpublishLectureAction(lectureId))}>
      {isPending ? "Moving..." : "Move to draft"}
    </Button>
  );
}

export function ArchiveButton({ lectureId }: { lectureId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        if (confirm("Archive this lecture? Students will no longer be able to see it.")) {
          startTransition(() => archiveLectureAction(lectureId));
        }
      }}
    >
      {isPending ? "Archiving..." : "Archive"}
    </Button>
  );
}
