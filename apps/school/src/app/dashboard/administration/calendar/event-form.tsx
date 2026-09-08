"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createEventAction, updateEventAction, type CalendarFormState } from "./actions";

const initialState: CalendarFormState = { status: "idle" };

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventForm({
  classArms,
  terms,
  event,
}: {
  classArms: { id: string; name: string; classGroup: { name: string } }[];
  terms: { id: string; name: string }[];
  event?: {
    id: string;
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    classArmId: string | null;
    termId: string | null;
    notifyAudience: "PARENTS" | "STAFF" | "BOTH" | null;
  };
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(event ? updateEventAction : createEventAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "success") return;
    if (event) {
      router.push("/dashboard/administration/calendar");
    } else {
      formRef.current?.reset();
    }
  }, [state.status, event, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <div className="space-y-1.5">
        <Label htmlFor="title">Event/Activity</Label>
        <Input id="title" name="title" required defaultValue={event?.title} placeholder="Mid-term break" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={event?.description ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startAt">Start date &amp; time</Label>
          <Input id="startAt" name="startAt" type="datetime-local" required defaultValue={event ? toLocalInputValue(event.startAt) : undefined} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endAt">End date &amp; time</Label>
          <Input id="endAt" name="endAt" type="datetime-local" required defaultValue={event ? toLocalInputValue(event.endAt) : undefined} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="classArmId">Class (optional)</Label>
          <Select id="classArmId" name="classArmId" defaultValue={event?.classArmId ?? ""}>
            <option value="">Whole school</option>
            {classArms.map((c) => <option key={c.id} value={c.id}>{c.classGroup.name} {c.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="termId">Term (optional)</Label>
          <Select id="termId" name="termId" defaultValue={event?.termId ?? ""}>
            <option value="">No specific term</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notifyAudience">Send notification (optional)</Label>
        <Select id="notifyAudience" name="notifyAudience" defaultValue={event?.notifyAudience ?? ""}>
          <option value="">No notification</option>
          <option value="PARENTS">Parents</option>
          <option value="STAFF">Staff</option>
          <option value="BOTH">Both parents &amp; staff</option>
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : event ? "Save changes" : "Submit & Save"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && !event && <p className="text-sm text-success">Event added.</p>}
    </form>
  );
}
