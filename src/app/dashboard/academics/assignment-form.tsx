"use client";

import { useActionState, useEffect, useRef } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTeacherAssignmentAction, type TeacherAssignmentState } from "./actions";

import { useActionToast } from "@/hooks/use-action-toast";

const initialState: TeacherAssignmentState = { status: "idle" };

export function TeacherAssignmentForm({
  teachers,
  subjects,
  classArms,
}: {
  teachers: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  classArms: { id: string; name: string; classGroup: { name: string } }[];
}) {
  const [state, formAction, isPending] = useActionState(createTeacherAssignmentAction, initialState);
  useActionToast(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-start gap-4">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="teacherId">Teacher</Label>
        <Select id="teacherId" name="teacherId" required defaultValue="">
          <option value="" disabled>Select teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      <div className="w-56 space-y-1.5">
        <Label>Subjects</Label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {subjects.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="subjectIds" value={s.id} className="h-4 w-4 rounded border-border" />
              {s.name}
            </label>
          ))}
        </div>
      </div>
      <div className="w-56 space-y-1.5">
        <Label>Classes</Label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {classArms.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="classArmIds" value={c.id} className="h-4 w-4 rounded border-border" />
              {c.classGroup.name} {c.name}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="self-end">{isPending ? "Assigning..." : "Assign"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
