"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { updateClassAssessmentModeAction, type PreschoolSettingsState } from "./actions";

const initialState: PreschoolSettingsState = { status: "idle" };
const MODES = ["NUMERICAL", "MILESTONE", "BOTH"] as const;

/// A controlled select, not `defaultValue` — React re-applies a <select>'s
/// defaultValue on every re-render (unlike <input>), so once the action's
/// pending state flips back to false and this component re-renders with
/// the same (stale, pre-save) `assessmentMode` prop, an uncontrolled select
/// snaps back to it even though the save already succeeded server-side.
/// Local state is the source of truth for what's shown; router.refresh()
/// keeps everything else on the page in sync with the real saved value.
export function ClassModeForm({ classGroupId, assessmentMode }: { classGroupId: string; assessmentMode: string }) {
  const [value, setValue] = useState(assessmentMode);
  const [state, setState] = useState<PreschoolSettingsState>(initialState);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = value;
          setValue(next);
          setState(initialState);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("classGroupId", classGroupId);
            formData.set("assessmentMode", next);
            const result = await updateClassAssessmentModeAction(initialState, formData);
            setState(result);
            if (result.status === "error") {
              setValue(previous);
            } else {
              router.refresh();
            }
          });
        }}
        className="w-40"
      >
        {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
      </Select>
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}
    </div>
  );
}
