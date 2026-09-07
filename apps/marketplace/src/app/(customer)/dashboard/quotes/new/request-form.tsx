"use client";

import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitCustomizationRequest, type RequestFormState } from "../actions";

const initial: RequestFormState = { status: "idle" };

export function RequestForm({ applications }: { applications: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(submitCustomizationRequest, initial);

  return (
    <form action={formAction} className="space-y-4">
      {applications.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="applicationId">Related application (optional)</Label>
          <Select id="applicationId" name="applicationId" defaultValue="">
            <option value="">Not related to a specific application</option>
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="description">What do you need?</Label>
        <Textarea id="description" name="description" rows={6} placeholder="Describe the customization or custom work you'd like..." required minLength={20} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="budget">Budget (optional)</Label>
          <Input id="budget" name="budget" type="number" min="0" step="0.01" placeholder="e.g. 500" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Deadline (optional)</Label>
          <Input id="deadline" name="deadline" type="date" />
        </div>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting..." : "Submit Request"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
