"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { deleteGuardianAction } from "../actions";

export function DeleteGuardianButton({ studentId, guardianId, guardianName }: { studentId: string; guardianId: string; guardianName: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-danger hover:text-danger"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Permanently delete ${guardianName}'s own record? This removes them from every student they're linked to, not just this one, and deletes their portal login if they have one. This can't be undone.\n\nTo just unlink them from this student, use "Remove" instead.`)) return;
        run(async () => {
          await deleteGuardianAction(studentId, guardianId);
          router.refresh();
        });
      }}
    >
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
