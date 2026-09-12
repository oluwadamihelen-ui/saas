"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startAiConversationAction } from "./actions";

export function StartConversationButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button size="sm" disabled={isPending} onClick={() => startTransition(() => startAiConversationAction())}>
      {isPending ? "Starting..." : "New conversation"}
    </Button>
  );
}
