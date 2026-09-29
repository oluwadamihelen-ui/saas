"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setUserStatusAction } from "./actions";

export function StatusToggle({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={status === "ACTIVE" ? "destructive" : "secondary"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setUserStatusAction(userId, status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
          router.refresh();
        })
      }
    >
      {status === "ACTIVE" ? "Suspend" : "Reactivate"}
    </Button>
  );
}
