"use client";

import { useActionState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { replyAsParentAction, type MessageFormState } from "../actions";

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const action = replyAsParentAction.bind(null, conversationId);
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as MessageFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <Textarea name="body" required rows={3} placeholder="Write a reply..." />
      <div className="flex items-center justify-between">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Sending..." : "Reply"}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
