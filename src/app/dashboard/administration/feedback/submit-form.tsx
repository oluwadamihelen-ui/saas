"use client";

import { useActionState, useEffect, useRef } from "react";
import { Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitFeedbackAction, type FeedbackFormState } from "./actions";

const initialState: FeedbackFormState = { status: "idle" };

export function SubmitFeedbackForm() {
  const [state, formAction, isPending] = useActionState(submitFeedbackAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="message">Your feedback or suggestion</Label>
        <Textarea id="message" name="message" required rows={4} placeholder="Tell us what's on your mind..." />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Submitting..." : "Submit feedback"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
