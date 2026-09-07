"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { registerCustomer, type RegisterState } from "./actions";

const initialState: RegisterState = { status: "idle" };

const ACCOUNT_TYPES = [
  { value: "CUSTOMER", label: "Buyer", description: "Purchase and deploy applications" },
  { value: "DEVELOPER", label: "Developer / Seller", description: "Submit apps to the marketplace and earn commission" },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerCustomer, initialState);
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPES)[number]["value"]>("CUSTOMER");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordsMismatch = useMemo(() => confirmPassword.length > 0 && password !== confirmPassword, [password, confirmPassword]);

  useEffect(() => {
    if (state.status === "success") {
      const form = document.getElementById("register-form") as HTMLFormElement | null;
      const email = (form?.elements.namedItem("email") as HTMLInputElement | null)?.value;
      if (email && password) {
        signIn("credentials", { email, password, redirect: false }).then(() => {
          router.push("/dashboard");
          router.refresh();
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, router]);

  return (
    <form id="register-form" action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label>I&apos;m signing up as</Label>
        <input type="hidden" name="accountType" value={accountType} />
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setAccountType(type.value)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                accountType === type.value ? "border-accent bg-accent-soft" : "border-border hover:bg-muted-surface"
              )}
            >
              <p className={cn("text-sm font-medium", accountType === type.value ? "text-accent" : "text-foreground")}>{type.label}</p>
              <p className="mt-0.5 text-xs text-muted">{type.description}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required placeholder="Jane Doe" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">Company (optional)</Label>
        <Input id="company" name="company" placeholder="Acme Ltd." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="jane@company.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={8}
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={passwordsMismatch}
        />
        {passwordsMismatch && <p className="text-sm text-danger">Passwords don&apos;t match.</p>}
      </div>
      <Button type="submit" disabled={isPending || passwordsMismatch} className="w-full">
        {isPending ? "Creating account..." : "Create account"}
      </Button>
      {state.status === "error" && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
