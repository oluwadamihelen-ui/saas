"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startClassFromRoomAction } from "../actions";

export function StartClassInlineButton({ liveClassId }: { liveClassId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button size="lg" disabled={isPending} onClick={() => startTransition(() => startClassFromRoomAction(liveClassId))}>
      {isPending ? "Starting class..." : "Start Class"}
    </Button>
  );
}
