"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteTeacherAssignmentAction } from "./actions";

export function DeleteAssignmentButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await deleteTeacherAssignmentAction(id);
        router.refresh();
      })}
    >
      Remove
    </Button>
  );
}
