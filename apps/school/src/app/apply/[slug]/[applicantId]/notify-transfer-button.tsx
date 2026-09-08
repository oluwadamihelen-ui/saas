"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { notifyApplicationFeeTransferAction, type ApplyFormState } from "../actions";

const initialState: ApplyFormState = { status: "idle" };

export function NotifyTransferButton({ slug, applicantId }: { slug: string; applicantId: string }) {
  const action = notifyApplicationFeeTransferAction.bind(null, slug, applicantId);
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
