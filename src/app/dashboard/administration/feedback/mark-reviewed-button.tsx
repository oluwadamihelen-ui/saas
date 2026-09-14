"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { markFeedbackReviewedAction } from "./actions";

export function MarkReviewedButton({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await markFeedbackReviewedAction(id);
          router.refresh();
        })
      }
    >
      Mark reviewed
    </Button>
  );
}
