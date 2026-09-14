"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { approveExpenseAction, rejectExpenseAction } from "./actions";

export function ApprovalButtons({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={isPending} onClick={() => run(async () => {
        await approveExpenseAction(id);
        router.refresh();
      })}>
        Approve
      </Button>
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(async () => {
        await rejectExpenseAction(id);
        router.refresh();
      })}>
        Reject
      </Button>
    </div>
  );
}
