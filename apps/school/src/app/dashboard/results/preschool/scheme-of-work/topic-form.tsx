"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addTopicAction, type SchemeOfWorkState } from "../actions";

const initialState: SchemeOfWorkState = { status: "idle" };

export function TopicForm({ schemeOfWorkId }: { schemeOfWorkId: string }) {
  const action = addTopicAction.bind(null, schemeOfWorkId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-24 space-y-1.5">
        <Label htmlFor="weekNumber">Week</Label>
        <Input id="weekNumber" name="weekNumber" type="number" min={1} max={52} required />
      </div>
      <div className="w-64 space-y-1.5">
        <Label htmlFor="title">Topic</Label>
        <Input id="title" name="title" required placeholder="e.g. Pronouns" />
      </div>
      <div className="w-64 space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={1} />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add topic"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
