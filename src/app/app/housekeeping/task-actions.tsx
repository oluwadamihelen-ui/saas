"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startTaskAction, completeTaskAction, inspectTaskAction } from "./actions";

export function TaskActions({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  if (status === "PENDING") {
    return (
      <Button size="sm" disabled={isPending} onClick={() => run(() => startTaskAction(taskId))}>
        Start Cleaning
      </Button>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <Button size="sm" disabled={isPending} onClick={() => run(() => completeTaskAction(taskId))}>
        Mark Complete
      </Button>
    );
  }
  if (status === "COMPLETED") {
    return (
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={() => run(() => inspectTaskAction(taskId, true))}>
          Pass Inspection
        </Button>
        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => run(() => inspectTaskAction(taskId, false))}>
          Fail
        </Button>
      </div>
    );
  }
  return null;
}
