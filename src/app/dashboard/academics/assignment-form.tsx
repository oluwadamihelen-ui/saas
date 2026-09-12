"use client";

import { useActionState, useEffect, useRef } from "react";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTeacherAssignmentAction, type TeacherAssignmentState } from "./actions";

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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="teacherId">Teacher</Label>
        <Select id="teacherId" name="teacherId" required defaultValue="">
          <option value="" disabled>Select teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      <div className="w-56 space-y-1.5">
        <Label htmlFor="subjectId">Subject</Label>
        <Select id="subjectId" name="subjectId" required defaultValue="">
          <option value="" disabled>Select subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <div className="w-56 space-y-1.5">
        <Label htmlFor="classArmId">Class</Label>
        <Select id="classArmId" name="classArmId" required defaultValue="">
          <option value="" disabled>Select class</option>
          {classArms.map((c) => <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>)}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Assigning..." : "Assign"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
