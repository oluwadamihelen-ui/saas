"use client";

import { useActionState } from "react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { gradeSubmissionAction, type GradeState } from "../actions";

const initialState: GradeState = { status: "idle" };

export function SubmissionRow({
  assignmentId,
  submission,
}: {
  assignmentId: string;
  submission: {
    id: string;
    status: "PENDING" | "SUBMITTED" | "GRADED";
    score: number | null;
    feedback: string | null;
    student: { firstName: string; lastName: string };
  };
}) {
  const action = gradeSubmissionAction.bind(null, assignmentId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-b-0">
      <input type="hidden" name="submissionId" value={submission.id} />
      <div className="flex w-56 items-center gap-2">
        <Avatar name={`${submission.student.firstName} ${submission.student.lastName}`} className="h-7 w-7 text-xs" />
        <span className="text-sm font-medium text-foreground">{submission.student.firstName} {submission.student.lastName}</span>
      </div>
      <Select name="status" defaultValue={submission.status === "PENDING" ? "SUBMITTED" : submission.status} className="w-36">
        <option value="SUBMITTED">Submitted</option>
        <option value="GRADED">Graded</option>
      </Select>
      <Input name="score" type="number" min={0} placeholder="Score" defaultValue={submission.score ?? ""} className="w-24" />
      <Input name="feedback" placeholder="Feedback" defaultValue={submission.feedback ?? ""} className="min-w-[10rem] flex-1" />
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      {state.status === "error" && <p className="w-full text-xs text-danger">{state.message}</p>}
    </form>
  );
}
