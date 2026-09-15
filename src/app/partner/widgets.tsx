"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { useSafeAction } from "@/hooks/use-safe-action";
import { requestWithdrawalAction, cancelWithdrawalAction, type PartnerActionState } from "./actions";

const initialState: PartnerActionState = { status: "idle" };

export function RequestWithdrawalButton({ disabled }: { disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(requestWithdrawalAction, initialState);
  useActionToast(state);

  return (
    <form action={formAction}>
      <Button type="submit" disabled={disabled || isPending} size="sm">
        {isPending ? "Requesting..." : "Request withdrawal"}
      </Button>
    </form>
  );
}

export function CancelWithdrawalButton({ withdrawalId }: { withdrawalId: string }) {
  const [isPending, run] = useSafeAction();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        run(async () => {
          await cancelWithdrawalAction(withdrawalId);
          router.refresh();
        })
      }
    >
      Cancel
    </Button>
  );
}
