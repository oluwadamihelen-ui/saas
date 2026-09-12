"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteSlotAction } from "./actions";

export function DeleteSlotButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await deleteSlotAction(id);
        router.refresh();
      })}
    >
      Remove
    </Button>
  );
}
