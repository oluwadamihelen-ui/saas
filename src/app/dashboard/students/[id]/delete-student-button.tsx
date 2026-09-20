"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { deleteStudentAction } from "../actions";

export function DeleteStudentButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Permanently delete ${studentName}? This erases their attendance, results, assignments and fee records too. This can't be undone.\n\nTo keep their history, use "Withdraw student" instead.`)) return;
        run(async () => {
          await deleteStudentAction(studentId);
          router.push("/dashboard/students");
        });
      }}
    >
      {isPending ? "Deleting..." : "Delete permanently"}
    </Button>
  );
}
