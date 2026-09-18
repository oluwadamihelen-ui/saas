"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSafeAction } from "@/hooks/use-safe-action";
import { deleteGradeBandAction, deleteComponentAction } from "../actions";

export function DeleteGradeBandButton({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(async () => {
      await deleteGradeBandAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}

export function DeleteComponentButton({ id }: { id: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(async () => {
      await deleteComponentAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}
