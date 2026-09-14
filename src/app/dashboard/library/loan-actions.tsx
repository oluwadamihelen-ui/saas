"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { returnLoanAction, markLoanLostAction } from "./actions";

export function LoanActions({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          run(async () => {
            await returnLoanAction(id);
            router.refresh();
          })
        }
      >
        Mark returned
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() =>
          run(async () => {
            await markLoanLostAction(id);
            router.refresh();
          })
        }
      >
        Mark lost
      </Button>
    </div>
  );
}
