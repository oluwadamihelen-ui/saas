"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startRequestAction, completeRequestAction, cancelRequestAction } from "./actions";

export function RequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  if (status === "COMPLETED" || status === "CANCELLED") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "REPORTED" || status === "ASSIGNED") && (
        <Button size="sm" disabled={isPending} onClick={() => run(() => startRequestAction(id))}>
          Start
        </Button>
      )}
      {status === "IN_PROGRESS" && (
        <Button size="sm" disabled={isPending} onClick={() => run(() => completeRequestAction(id))}>
          Mark Resolved
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => cancelRequestAction(id))}>
        Cancel
      </Button>
    </div>
  );
}
