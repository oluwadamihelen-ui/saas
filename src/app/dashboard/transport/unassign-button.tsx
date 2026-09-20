"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { unassignStudentFromRouteAction } from "./actions";

export function UnassignButton({ assignmentId, routeId }: { assignmentId: string; routeId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await unassignStudentFromRouteAction(assignmentId, routeId);
          router.refresh();
        })
      }
    >
      Remove
    </Button>
  );
}
