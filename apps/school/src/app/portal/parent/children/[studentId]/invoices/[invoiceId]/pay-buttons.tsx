"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { payOnlineFromPortalAction, notifyBankTransferFromPortalAction, type PortalPayFormState } from "./actions";

const initialState: PortalPayFormState = { status: "idle" };

export function PortalPayOnlineButton({ studentId, invoiceId }: { studentId: string; invoiceId: string }) {
  const action = payOnlineFromPortalAction.bind(null, studentId, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Redirecting..." : "Pay online"}</Button>
      {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function PortalNotifyBankTransferButton({ studentId, invoiceId }: { studentId: string; invoiceId: string }) {
  const action = notifyBankTransferFromPortalAction.bind(null, studentId, invoiceId);
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
