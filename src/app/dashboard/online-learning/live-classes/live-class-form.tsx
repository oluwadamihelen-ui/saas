"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface LiveClassFormState {
  status: "idle" | "error";
  message?: string;
}

export interface LiveClassFormDefaults {
  subjectClassKey?: string;
  termId?: string;
  title?: string;
  topic?: string;
  description?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  maxParticipants?: number | "";
  joinWindowMinutesBefore?: number;
}

export function LiveClassForm({
  action,
  assignments,
  terms,
  defaults,
  submitLabel,
}: {
  action: (prevState: LiveClassFormState, formData: FormData) => Promise<LiveClassFormState>;
  assignments: { subjectId: string; classArmId: string; subject: { name: string }; classArm: { name: string; classGroup: { name: string } } }[];
  terms: { id: string; name: string; academicSessionId: string; academicSession: { name: string } }[];
  defaults?: LiveClassFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as LiveClassFormState);

  return (
    <form action={formAction} className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="subjectClassKey">Subject &amp; class</Label>
          <Select id="subjectClassKey" name="subjectClassKey" required defaultValue={defaults?.subjectClassKey ?? ""}>
            <option value="" disabled>
              Select subject and class
            </option>
            {assignments.map((a) => (
              <option key={`${a.subjectId}|${a.classArmId}`} value={`${a.subjectId}|${a.classArmId}`}>
                {a.subject.name} — {a.classArm.classGroup.name} {a.classArm.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="termId">Term</Label>
          <Select id="termId" name="termId" required defaultValue={defaults?.termId ?? ""}>
            <option value="" disabled>
              Select term
            </option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicSession.name} — {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Class title</Label>
        <Input id="title" name="title" required defaultValue={defaults?.title} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="topic">Topic</Label>
        <Input id="topic" name="topic" defaultValue={defaults?.topic} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaults?.description} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="scheduledDate">Date</Label>
          <Input id="scheduledDate" name="scheduledDate" type="date" required defaultValue={defaults?.scheduledDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledTime">Start time</Label>
          <Input id="scheduledTime" name="scheduledTime" type="time" required defaultValue={defaults?.scheduledTime} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="durationMinutes">Expected duration (minutes)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={5} max={300} required defaultValue={defaults?.durationMinutes ?? 40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxParticipants">Max participants (optional)</Label>
          <Input id="maxParticipants" name="maxParticipants" type="number" min={1} defaultValue={defaults?.maxParticipants} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="joinWindowMinutesBefore">Waiting room opens (minutes before)</Label>
          <Input id="joinWindowMinutesBefore" name="joinWindowMinutesBefore" type="number" min={0} max={120} defaultValue={defaults?.joinWindowMinutesBefore ?? 15} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : submitLabel}</Button>
        <Button asChild variant="secondary" type="button">
          <Link href="/dashboard/online-learning/live-classes">Cancel</Link>
        </Button>
        {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      </div>
    </form>
  );
}
