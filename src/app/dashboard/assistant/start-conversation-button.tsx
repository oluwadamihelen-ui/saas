"use client";

import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { startAiConversationAction } from "./actions";

export function StartConversationButton() {
  const [isPending, run] = useSafeAction();

  return (
    <Button size="sm" disabled={isPending} onClick={() => run(() => startAiConversationAction())}>
      {isPending ? "Starting..." : "New conversation"}
    </Button>
  );
}
