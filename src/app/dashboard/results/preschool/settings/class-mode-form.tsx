"use client";

import { useActionState } from "react";
import { Select } from "@/components/ui/input";
import { updateClassAssessmentModeAction, type PreschoolSettingsState } from "./actions";

const initialState: PreschoolSettingsState = { status: "idle" };
const MODES = ["NUMERICAL", "MILESTONE", "BOTH"] as const;

export function ClassModeForm({ classGroupId, assessmentMode }: { classGroupId: string; assessmentMode: string }) {
  const [state, formAction, isPending] = useActionState(updateClassAssessmentModeAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="classGroupId" value={classGroupId} />
      <Select
        name="assessmentMode"
        defaultValue={assessmentMode}
        disabled={isPending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-40"
      >
        {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
      </Select>
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}
