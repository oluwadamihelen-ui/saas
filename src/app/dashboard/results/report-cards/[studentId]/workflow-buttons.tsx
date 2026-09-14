"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { approveReportCardAction, publishReportCardAction } from "../../actions";

export function ApproveButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      disabled={isPending}
      onClick={() => run(async () => {
        await approveReportCardAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Approving..." : "Approve"}
    </Button>
  );
}

export function PublishButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      disabled={isPending}
      onClick={() => run(async () => {
        await publishReportCardAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Publishing..." : "Publish"}
    </Button>
  );
}
