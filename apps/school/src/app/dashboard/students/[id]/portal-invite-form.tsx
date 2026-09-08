"use client";

import { useActionState, useRef, useEffect } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PortalInviteState } from "../actions";

export function PortalInviteForm({
  action,
  defaultEmail,
}: {
  action: (prevState: PortalInviteState, formData: FormData) => Promise<PortalInviteState>;
  defaultEmail?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as PortalInviteState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="email">Login email</Label>
        <Input id="email" name="email" type="email" required defaultValue={defaultEmail ?? ""} placeholder="name@example.com" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Sending..." : "Send portal invite"}</Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-success">Invite sent — copy the link below.</p>}
    </form>
  );
}
