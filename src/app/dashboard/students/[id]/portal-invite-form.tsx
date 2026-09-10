"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PortalInviteState } from "../actions";

export function PortalInviteForm({
  action,
  defaultEmail,
  allowAdmissionNumberLogin,
}: {
  action: (prevState: PortalInviteState, formData: FormData) => Promise<PortalInviteState>;
  defaultEmail?: string | null;
  /// Only meaningful for a student invite (a guardian is always an adult
  /// with their own email) — shows a toggle that skips the email field
  /// entirely and logs the student in with their admission number instead.
  /// See inviteStudentToPortal in src/lib/services/portal-invites.ts.
  allowAdmissionNumberLogin?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as PortalInviteState);
  const [useAdmissionNumber, setUseAdmissionNumber] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [prevStatus, setPrevStatus] = useState(state.status);
  if (state.status !== prevStatus) {
    setPrevStatus(state.status);
    if (state.status === "success") {
      setUseAdmissionNumber(false);
    }
  }

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="email">Login email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required={!useAdmissionNumber}
            disabled={useAdmissionNumber}
            defaultValue={defaultEmail ?? ""}
            placeholder={useAdmissionNumber ? "Not needed — logs in with admission number" : "name@example.com"}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Sending..." : "Send portal invite"}</Button>
      </div>
      {allowAdmissionNumberLogin && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            name="useAdmissionNumber"
            checked={useAdmissionNumber}
            onChange={(e) => setUseAdmissionNumber(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          This student doesn&apos;t have an email — log in with admission number instead
        </label>
      )}
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">Invite sent — copy the link below.</p>}
    </form>
  );
}
