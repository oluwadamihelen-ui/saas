"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approveReportCardAction, publishReportCardAction } from "../../actions";

export function ApproveButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await approveReportCardAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Approving..." : "Approve"}
    </Button>
  );
}

export function PublishButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await publishReportCardAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Publishing..." : "Publish"}
    </Button>
  );
}
