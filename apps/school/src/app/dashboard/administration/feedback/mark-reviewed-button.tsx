"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markFeedbackReviewedAction } from "./actions";

export function MarkReviewedButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markFeedbackReviewedAction(id);
          router.refresh();
        })
      }
    >
      Mark reviewed
    </Button>
  );
}
