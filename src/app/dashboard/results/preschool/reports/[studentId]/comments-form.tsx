"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  updatePreschoolCommentsAction,
  generatePreschoolCommentAction,
  type PreschoolReportState,
  type GenerateCommentState,
} from "../actions";

const initialState: PreschoolReportState = { status: "idle" };
const initialGenerateState: GenerateCommentState = { status: "idle" };

export function CommentsForm({
  studentId,
  termId,
  overallComment,
  teacherComment,
  principalComment,
  canEditPrincipalComment,
}: {
  studentId: string;
  termId: string;
  overallComment: string;
  teacherComment: string;
  principalComment: string;
  canEditPrincipalComment: boolean;
}) {
  const action = updatePreschoolCommentsAction.bind(null, studentId, termId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const generateAction = generatePreschoolCommentAction.bind(null, studentId, termId);
  const [generateState, runGenerate, isGenerating] = useActionState(generateAction, initialGenerateState);
  const [, startTransition] = useTransition();
  const overallRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (generateState.status === "success" && generateState.comment && overallRef.current) {
      overallRef.current.value = generateState.comment;
    }
  }, [generateState]);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="overallComment">Overall developmental comment</Label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isGenerating}
              onClick={() => startTransition(() => runGenerate())}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {isGenerating ? "Generating..." : "Generate Comment with AI"}
            </Button>
          </div>
          <Textarea id="overallComment" name="overallComment" ref={overallRef} defaultValue={overallComment} rows={4} />
          {generateState.status === "error" && <p className="text-sm text-danger">{generateState.message}</p>}
          {generateState.status === "success" && <p className="text-sm text-muted">AI-generated from this student&apos;s assessed milestones — review and edit before saving.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teacherComment">Teacher&apos;s comment</Label>
          <Textarea id="teacherComment" name="teacherComment" defaultValue={teacherComment} />
        </div>
        {canEditPrincipalComment && (
          <div className="space-y-1.5">
            <Label htmlFor="principalComment">Head teacher&apos;s comment</Label>
            <Textarea id="principalComment" name="principalComment" defaultValue={principalComment} />
          </div>
        )}
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Save comments"}</Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
        {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
      </form>
    </div>
  );
}
