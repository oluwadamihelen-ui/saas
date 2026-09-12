"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteGradeBandAction, deleteComponentAction } from "../actions";

export function DeleteGradeBandButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(async () => {
      await deleteGradeBandAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}

export function DeleteComponentButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" disabled={isPending} onClick={() => startTransition(async () => {
      await deleteComponentAction(id);
      router.refresh();
    })}>
      Remove
    </Button>
  );
}
