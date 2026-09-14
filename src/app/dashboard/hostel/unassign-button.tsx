"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { unassignStudentFromRoomAction } from "./actions";

export function UnassignButton({ assignmentId, hostelId }: { assignmentId: string; hostelId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await unassignStudentFromRoomAction(assignmentId, hostelId);
          router.refresh();
        })
      }
    >
      Remove
    </Button>
  );
}
