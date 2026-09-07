"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { registerSchool, type RegisterState } from "./actions";

const initialState: RegisterState = { status: "idle" };

export function RegisterForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerSchool, initialState);
  // React resets uncontrolled form fields once the action succeeds, so we
  // can't read email/password back off the DOM in the effect below — keep
  // them in state, captured as the user types instead.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.status === "success" && email && password) {
      signIn("credentials", { email, password, redirect: false }).then(() => {
        router.push("/onboarding");
        router.refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="schoolName">School name</Label>
        <Input id="schoolName" name="schoolName" required placeholder="Greenfield Academy" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ownerName">Your full name</Label>
        <Input id="ownerName" name="ownerName" required placeholder="Jane Doe" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="jane@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
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
        {isPending ? "Creating your school..." : "Create school account"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
