"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { withdrawStudentAction } from "../actions";

export function WithdrawButton({ studentId }: { studentId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Withdraw this student? Their record is kept, but they'll be marked withdrawn.")) return;
        run(async () => {
          await withdrawStudentAction(studentId);
          router.refresh();
        });
      }}
    >
      {isPending ? "Withdrawing..." : "Withdraw student"}
    </Button>
  );
}
