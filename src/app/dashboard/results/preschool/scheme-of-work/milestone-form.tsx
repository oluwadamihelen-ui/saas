"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addMilestoneAction, type SchemeOfWorkState } from "../actions";

const initialState: SchemeOfWorkState = { status: "idle" };

export function MilestoneForm({ topicId }: { topicId: string }) {
  const action = addMilestoneAction.bind(null, topicId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
      <div className="w-72 space-y-1.5">
        <Label htmlFor={`milestone-title-${topicId}`}>Milestone / learning outcome</Label>
        <Input id={`milestone-title-${topicId}`} name="title" required placeholder="e.g. Identify pronouns" />
      </div>
      <div className="w-72 space-y-1.5">
        <Label htmlFor={`milestone-desc-${topicId}`}>Description (optional)</Label>
        <Input id={`milestone-desc-${topicId}`} name="description" placeholder="e.g. Recognize common pronouns in a sentence" />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Adding..." : "Add milestone"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
