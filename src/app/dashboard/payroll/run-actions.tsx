"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { approvePayrollRunAction, markPayrollRunPaidAction } from "./actions";

export function RunActions({ id, status }: { id: string; status: "DRAFT" | "APPROVED" | "PAID" }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  if (status === "PAID") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              await approvePayrollRunAction(id);
              router.refresh();
            })
          }
        >
          Approve
        </Button>
      )}
      {status === "APPROVED" && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              await markPayrollRunPaidAction(id);
              router.refresh();
            })
          }
        >
          Mark paid
        </Button>
      )}
    </div>
  );
}
