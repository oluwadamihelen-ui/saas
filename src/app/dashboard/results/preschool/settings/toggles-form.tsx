"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updatePreschoolTogglesAction, type PreschoolSettingsState } from "./actions";
import type { School } from "@/generated/prisma/client";

const initialState: PreschoolSettingsState = { status: "idle" };

const FIELDS: { name: keyof Pick<School,
  "preschoolResultsEnabled" | "preschoolRequireTeacherComment" | "preschoolRequireApprovalToPublish" |
  "preschoolParentsCanView" | "preschoolStudentsCanView">; label: string; hint: string }[] = [
  { name: "preschoolResultsEnabled", label: "Enable Pre-School Results", hint: "Shows the Pre-School Results section in navigation and lets classes use milestone assessment." },
  { name: "preschoolRequireTeacherComment", label: "Require a teacher comment", hint: "Teachers must add a comment before a milestone report can be submitted." },
  { name: "preschoolRequireApprovalToPublish", label: "Require approval before publishing", hint: "A milestone report must be Approved before it can be Published." },
  { name: "preschoolParentsCanView", label: "Parents can view milestone results", hint: "Shown only for published reports in the Parent Portal." },
  { name: "preschoolStudentsCanView", label: "Students can view milestone results", hint: "Shown only for published reports in the Student Portal, where the student has a login." },
];

export function TogglesForm({ school }: { school: School }) {
  const [state, formAction, isPending] = useActionState(updatePreschoolTogglesAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {FIELDS.map((f) => (
        <label key={f.name} className="flex items-start gap-3 text-sm text-foreground">
          <input type="checkbox" name={f.name} defaultChecked={school[f.name]} className="mt-0.5 h-4 w-4 rounded border-border" />
          <span>
            <span className="block font-medium">{f.label}</span>
            <span className="block text-xs text-muted">{f.hint}</span>
          </span>
        </label>
      ))}
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving..." : "Save settings"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">{state.message}</p>}
    </form>
  );
}
