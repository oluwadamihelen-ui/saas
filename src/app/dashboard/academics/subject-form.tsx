"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSubjectAction, type SubjectFormState } from "./actions";

const initialState: SubjectFormState = { status: "idle" };

export function SubjectForm() {
  const [state, formAction, isPending] = useActionState(createSubjectAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="name">Subject name</Label>
        <Input id="name" name="name" required placeholder="e.g. Further Mathematics" />
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" required placeholder="e.g. FMTH" maxLength={20} />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add subject"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="w-full text-sm text-success">{state.message}</p>}
    </form>
  );
}
