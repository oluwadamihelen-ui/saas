"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approvePayrollRunAction, markPayrollRunPaidAction } from "./actions";

export function RunActions({ id, status }: { id: string; status: "DRAFT" | "APPROVED" | "PAID" }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "PAID") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
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
            startTransition(async () => {
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
