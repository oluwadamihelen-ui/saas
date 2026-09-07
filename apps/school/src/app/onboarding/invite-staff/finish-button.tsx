"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { finishOnboarding } from "./actions";

export function FinishButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => startTransition(() => finishOnboarding())}
    >
      {isPending ? "Finishing up..." : "Finish setup and go to dashboard"}
    </Button>
  );
}
