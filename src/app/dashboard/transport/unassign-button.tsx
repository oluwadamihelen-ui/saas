"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { unassignStudentFromRouteAction } from "./actions";

export function UnassignButton({ assignmentId, routeId }: { assignmentId: string; routeId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await unassignStudentFromRouteAction(assignmentId, routeId);
          router.refresh();
        })
      }
    >
      Remove
    </Button>
  );
}
