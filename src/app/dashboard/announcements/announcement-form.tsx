"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAnnouncementAction, type AnnouncementFormState } from "./actions";

const initialState: AnnouncementFormState = { status: "idle" };

export function AnnouncementForm({ classArms }: { classArms: { id: string; name: string; classGroup: { name: string } }[] }) {
  const [state, formAction, isPending] = useActionState(createAnnouncementAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState("SCHOOL_WIDE");

  // Adjusting state during render (not in an effect) in response to a
  // prop/state transition, per https://react.dev/learn/you-might-not-need-an-effect
  const [prevStatus, setPrevStatus] = useState(state.status);
  if (state.status !== prevStatus) {
    setPrevStatus(state.status);
    if (state.status === "success") setAudience("SCHOOL_WIDE");
  }

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="Mid-term break notice" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" required rows={4} placeholder="Write the announcement..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="audience">Audience</Label>
          <Select id="audience" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="SCHOOL_WIDE">Whole school</option>
            <option value="STAFF_ONLY">Staff only</option>
            <option value="PARENTS_ONLY">Parents only</option>
            <option value="CLASS">A specific class</option>
          </Select>
        </div>
        {audience === "CLASS" && (
          <div className="space-y-1.5">
            <Label htmlFor="classArmId">Class</Label>
            <Select id="classArmId" name="classArmId" required defaultValue="">
              <option value="" disabled>Select class</option>
              {classArms.map((c) => (
                <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="publishNow" defaultChecked className="h-4 w-4 rounded border-border" />
        Publish immediately
      </label>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save announcement"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">Announcement saved.</p>}
    </form>
  );
}
