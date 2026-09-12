"use client";

import { useActionState } from "react";
import { Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateCommentsAction, type GradingConfigState } from "../../actions";

const initialState: GradingConfigState = { status: "idle" };

export function CommentsForm({
  studentId,
  termId,
  teacherComment,
  principalComment,
  canEditPrincipalComment,
}: {
  studentId: string;
  termId: string;
  teacherComment: string;
  principalComment: string;
  canEditPrincipalComment: boolean;
}) {
  const action = updateCommentsAction.bind(null, studentId, termId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="teacherComment">Teacher&apos;s comment</Label>
        <Textarea id="teacherComment" name="teacherComment" defaultValue={teacherComment} />
      </div>
      {canEditPrincipalComment && (
        <div className="space-y-1.5">
          <Label htmlFor="principalComment">Principal&apos;s comment</Label>
          <Textarea id="principalComment" name="principalComment" defaultValue={principalComment} />
        </div>
      )}
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Save comments"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
