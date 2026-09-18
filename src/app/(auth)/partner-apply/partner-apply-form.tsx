"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { applyAsPartnerAction, type PartnerApplyState } from "./actions";

const initialState: PartnerApplyState = { status: "idle" };

export function PartnerApplyForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(applyAsPartnerAction, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault();
      setMismatchError("Passwords do not match.");
      return;
    }
    setMismatchError(null);
  }

  if (state.status === "success") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg font-semibold text-foreground">Application submitted</p>
        <p className="text-sm text-muted">
          We&apos;ll review your application and let you know once it&apos;s approved. You can sign in any time to check your status.
        </p>
        <Button className="w-full" onClick={() => router.push("/login")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Your name</Label>
        <Input id="displayName" name="displayName" required placeholder="Jane Doe" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+234..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Submitting..." : "Submit application"}
      </Button>
      {mismatchError && <p className="text-sm text-danger">{mismatchError}</p>}
      {!mismatchError && state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
