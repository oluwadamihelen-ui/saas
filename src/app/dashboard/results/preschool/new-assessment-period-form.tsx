"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAssessmentPeriodAction, type MilestoneGridState } from "./actions";

const TYPES = [
  { value: "CONTINUOUS_ASSESSMENT", label: "Continuous Assessment" },
  { value: "TEST", label: "Test" },
  { value: "EXAMINATION", label: "Examination" },
  { value: "MID_TERM", label: "Mid-Term" },
  { value: "END_OF_TERM", label: "End of Term" },
  { value: "OBSERVATION", label: "Observation" },
  { value: "WEEKLY", label: "Weekly Assessment" },
  { value: "CUSTOM", label: "Custom" },
];

const initialState: MilestoneGridState = { status: "idle" };

export function NewAssessmentPeriodForm({ termId }: { termId: string }) {
  const action = createAssessmentPeriodAction.bind(null, termId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1.5">
        <Label htmlFor="name">Period name</Label>
        <Input id="name" name="name" required placeholder="e.g. Mid-Term Test" />
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <Select id="type" name="type" defaultValue="CUSTOM">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Adding..." : "Add period"}</Button>
      {state.status === "error" && <p className="w-full text-sm text-danger">{state.message}</p>}
    </form>
  );
}
