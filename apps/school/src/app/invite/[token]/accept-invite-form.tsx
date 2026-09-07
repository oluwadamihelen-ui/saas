"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { acceptStaffInvite, type AcceptInviteState } from "./actions";

const initialState: AcceptInviteState = { status: "idle" };

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(acceptStaffInvite, initialState);
  // React resets uncontrolled fields once the action succeeds, so capture
  // the password in state as the user types rather than reading the DOM.
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.status === "success" && password) {
      signIn("credentials", { email, password, redirect: false }).then(() => {
        router.push("/dashboard");
        router.refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required placeholder="Jane Doe" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Choose a password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Activating..." : "Activate account"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
