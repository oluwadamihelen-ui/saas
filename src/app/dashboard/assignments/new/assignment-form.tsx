"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAssignmentAction, type AssignmentFormState } from "../actions";

const initialState: AssignmentFormState = { status: "idle" };

export function AssignmentForm({
  classArms,
  subjects,
}: {
  classArms: { id: string; name: string; classGroup: { name: string } }[];
  subjects: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createAssignmentAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="Fractions worksheet" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="classArmId">Class</Label>
          <Select id="classArmId" name="classArmId" required defaultValue="">
            <option value="" disabled>Select class</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subjectId">Subject</Label>
          <Select id="subjectId" name="subjectId" required defaultValue="">
            <option value="" disabled>Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dueDate">Due date</Label>
        <Input id="dueDate" name="dueDate" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" placeholder="Instructions for the class..." />
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create assignment"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
