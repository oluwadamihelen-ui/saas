"use client";

import { useActionState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveAcademicStructure, type AcademicStructureState } from "./actions";

const initialState: AcademicStructureState = { status: "idle" };

const thisYear = new Date().getFullYear();

export function AcademicStructureForm() {
  const [state, formAction, isPending] = useActionState(saveAcademicStructure, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sessionName">Academic session</Label>
        <Input id="sessionName" name="sessionName" required defaultValue={`${thisYear}/${thisYear + 1}`} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Session start</Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={`${thisYear}-09-01`} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">Session end</Label>
          <Input id="endDate" name="endDate" type="date" required defaultValue={`${thisYear + 1}-07-15`} />
        </div>
      </div>
      <p className="text-xs text-muted">We&apos;ll split this into First, Second and Third Term automatically — you can adjust dates later.</p>

      <div className="space-y-1.5">
        <Label htmlFor="classNames">Classes</Label>
        <Textarea
          id="classNames"
          name="classNames"
          required
          placeholder="JSS1, JSS2, JSS3, SS1, SS2, SS3"
          defaultValue="JSS1, JSS2, JSS3, SS1, SS2, SS3"
        />
        <p className="text-xs text-muted">Comma-separated. Each gets a default arm (&quot;A&quot;) — add more arms later.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subjectNames">Subjects (optional)</Label>
        <Textarea
          id="subjectNames"
          name="subjectNames"
          placeholder="Mathematics, English Language, Basic Science, Social Studies"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Setting up..." : "Continue"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
