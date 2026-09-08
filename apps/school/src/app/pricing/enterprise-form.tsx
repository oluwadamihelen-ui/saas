"use client";

import { useActionState, useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { submitEnterpriseInquiryAction, type EnterpriseFormState } from "./actions";

const initialState: EnterpriseFormState = { status: "idle" };

export function EnterpriseInquiryForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(submitEnterpriseInquiryAction, initialState);

  if (!open) {
    return (
      <Button size="lg" variant="secondary" onClick={() => setOpen(true)}>
        Let&apos;s build a plan for your school
      </Button>
    );
  }

  if (state.status === "success") {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-border bg-surface p-6 text-center">
        <p className="font-medium text-foreground">Thanks — we&apos;ve got your details.</p>
        <p className="mt-1 text-sm text-muted">Our team will reach out shortly to put together a plan for your school or group.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-surface p-6 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="schoolOrGroupName">School / group name</Label>
          <Input id="schoolOrGroupName" name="schoolOrGroupName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Your name</Label>
          <Input id="contactName" name="contactName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="studentCount">Number of students</Label>
          <Input id="studentCount" name="studentCount" type="number" min={0} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campusCount">Number of campuses</Label>
          <Input id="campusCount" name="campusCount" type="number" min={0} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currentSoftware">What do you use today, if anything?</Label>
        <Input id="currentSoftware" name="currentSoftware" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Anything else we should know?</Label>
        <Textarea id="message" name="message" rows={3} />
      </div>

      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>{isPending ? "Sending..." : "Send inquiry"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
