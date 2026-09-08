"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { payOnlineAction, notifyBankTransferAction, type PayActionState } from "./actions";

const initialState: PayActionState = { status: "idle" };

export function PayOnlineButton({ token }: { token: string }) {
  const action = payOnlineAction.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Redirecting..." : "Pay online"}</Button>
      {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function NotifyBankTransferButton({ token }: { token: string }) {
  const action = notifyBankTransferAction.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" variant="secondary" className="w-full" disabled={isPending}>
        {isPending ? "Recording..." : "I've made this bank transfer"}
      </Button>
      {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
    </form>
  );
}
