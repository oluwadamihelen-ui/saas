"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { returnLoanAction, markLoanLostAction } from "./actions";

export function LoanActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
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
          startTransition(async () => {
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
