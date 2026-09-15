"use client";

import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { finishOnboarding } from "./actions";

export function FinishButton() {
  const [isPending, run] = useSafeAction();
  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => run(() => finishOnboarding())}
    >
      {isPending ? "Finishing up..." : "Finish setup and go to dashboard"}
    </Button>
  );
}
