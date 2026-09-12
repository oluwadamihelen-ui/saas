"use client";

import { useActionState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendAiMessageAction, type AssistantMessageState } from "../actions";

export function ChatForm({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const action = sendAiMessageAction.bind(null, conversationId);
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as AssistantMessageState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <Textarea name="text" required rows={2} placeholder="Ask about a student, attendance, results, fees..." disabled={isPending} />
      <div className="flex items-center justify-between">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Thinking..." : "Send"}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
