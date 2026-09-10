"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { payApplicationFeeOnlineAction, type ApplyFormState } from "../actions";

const initialState: ApplyFormState = { status: "idle" };

export function PayApplicationFeeOnlineButton({ slug, applicantId }: { slug: string; applicantId: string }) {
  const action = payApplicationFeeOnlineAction.bind(null, slug, applicantId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Redirecting..." : "Pay online"}</Button>
      {state.status === "error" && <p className="mt-2 text-sm text-danger">{state.message}</p>}
    </form>
  );
}
