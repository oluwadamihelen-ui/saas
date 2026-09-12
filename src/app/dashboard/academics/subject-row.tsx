"use client";

import { useActionState, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateSubjectAction, type SubjectFormState } from "./actions";

const initialState: SubjectFormState = { status: "idle" };

export function SubjectRow({ subject }: { subject: { id: string; name: string; code: string } }) {
  const [isEditing, setIsEditing] = useState(false);
  const action = updateSubjectAction.bind(null, subject.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [prevState, setPrevState] = useState(state);

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm transition-colors hover:border-primary"
        title="Edit subject"
      >
        <Badge variant="neutral">{subject.name} ({subject.code})</Badge>
        <Pencil className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }

  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setIsEditing(false);
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
      <div className="w-44 space-y-1">
        <Input name="name" defaultValue={subject.name} required maxLength={100} />
      </div>
      <div className="w-28 space-y-1">
        <Input name="code" defaultValue={subject.code} required maxLength={20} />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
        <X className="h-4 w-4" />
      </Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
