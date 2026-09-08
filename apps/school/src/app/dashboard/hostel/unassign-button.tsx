"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { unassignStudentFromRoomAction } from "./actions";

export function UnassignButton({ assignmentId, hostelId }: { assignmentId: string; hostelId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await unassignStudentFromRoomAction(assignmentId, hostelId);
          router.refresh();
        })
      }
    >
      Remove
    </Button>
  );
}
