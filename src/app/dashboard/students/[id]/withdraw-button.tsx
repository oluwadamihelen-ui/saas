"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { withdrawStudentAction } from "../actions";

export function WithdrawButton({ studentId }: { studentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Withdraw this student? Their record is kept, but they'll be marked withdrawn.")) return;
        startTransition(async () => {
          await withdrawStudentAction(studentId);
          router.refresh();
        });
      }}
    >
      {isPending ? "Withdrawing..." : "Withdraw student"}
    </Button>
  );
}
