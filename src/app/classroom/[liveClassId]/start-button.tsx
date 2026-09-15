"use client";

import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { startClassFromRoomAction } from "../actions";

export function StartClassInlineButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, run] = useSafeAction();
  return (
    <Button size="lg" disabled={isPending} onClick={() => run(() => startClassFromRoomAction(liveClassId))}>
      {isPending ? "Starting class..." : "Start Class"}
    </Button>
  );
}
