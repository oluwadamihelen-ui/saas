"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import {
  submitPreschoolReportAction,
  approvePreschoolReportAction,
  publishPreschoolReportAction,
  reopenPreschoolReportAction,
} from "../actions";

export function SubmitButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      disabled={isPending}
      onClick={() => run(async () => {
        await submitPreschoolReportAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Submitting..." : "Submit"}
    </Button>
  );
}

export function ApproveButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      disabled={isPending}
      onClick={() => run(async () => {
        await approvePreschoolReportAction(studentId, termId);
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
        await publishPreschoolReportAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Publishing..." : "Publish"}
    </Button>
  );
}

export function ReopenButton({ studentId, termId }: { studentId: string; termId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      disabled={isPending}
      onClick={() => run(async () => {
        await reopenPreschoolReportAction(studentId, termId);
        router.refresh();
      })}
    >
      {isPending ? "Reopening..." : "Reopen"}
    </Button>
  );
}
