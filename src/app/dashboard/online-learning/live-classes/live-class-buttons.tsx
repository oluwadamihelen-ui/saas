"use client";

import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { cancelLiveClassAction, startLiveClassAction, endLiveClassAction } from "./actions";

export function StartClassButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => run(() => startLiveClassAction(liveClassId))}
    >
      {isPending ? "Starting..." : "Start Class"}
    </Button>
  );
}

export function EndClassButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() => {
        if (confirm("End this live class for everyone?")) run(() => endLiveClassAction(liveClassId));
      }}
    >
      {isPending ? "Ending..." : "End Class"}
    </Button>
  );
}

export function CancelClassButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        if (confirm("Cancel this live class? Students will be notified.")) run(() => cancelLiveClassAction(liveClassId));
      }}
    >
      {isPending ? "Cancelling..." : "Cancel"}
    </Button>
  );
}
