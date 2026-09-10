"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelLiveClassAction, startLiveClassAction, endLiveClassAction } from "./actions";

export function StartClassButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => startLiveClassAction(liveClassId))}
    >
      {isPending ? "Starting..." : "Start Class"}
    </Button>
  );
}

export function EndClassButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() => {
        if (confirm("End this live class for everyone?")) startTransition(() => endLiveClassAction(liveClassId));
      }}
    >
      {isPending ? "Ending..." : "End Class"}
    </Button>
  );
}

export function CancelClassButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        if (confirm("Cancel this live class? Students will be notified.")) startTransition(() => cancelLiveClassAction(liveClassId));
      }}
    >
      {isPending ? "Cancelling..." : "Cancel"}
    </Button>
  );
}
