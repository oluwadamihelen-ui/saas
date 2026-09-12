"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approveExpenseAction, rejectExpenseAction } from "./actions";

export function ApprovalButtons({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={isPending} onClick={() => startTransition(async () => {
        await approveExpenseAction(id);
        router.refresh();
      })}>
        Approve
      </Button>
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => startTransition(async () => {
        await rejectExpenseAction(id);
        router.refresh();
      })}>
        Reject
      </Button>
    </div>
  );
}
