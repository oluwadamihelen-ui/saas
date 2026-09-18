"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { removeGuardianAction } from "../actions";

export function RemoveGuardianButton({ studentId, guardianId, guardianName }: { studentId: string; guardianId: string; guardianName: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Remove ${guardianName} as a guardian of this student? Their own record is kept — this only unlinks them from this student.`)) return;
        run(async () => {
          await removeGuardianAction(studentId, guardianId);
          router.refresh();
        });
      }}
    >
      {isPending ? "Removing..." : "Remove"}
    </Button>
  );
}
