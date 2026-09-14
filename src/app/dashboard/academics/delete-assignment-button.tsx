"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { deleteTeacherAssignmentAction } from "./actions";

export function DeleteAssignmentButton({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => run(async () => {
        await deleteTeacherAssignmentAction(id);
        router.refresh();
      })}
    >
      Remove
    </Button>
  );
}
