"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Mode = "email" | "student";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = React.useState<Mode>("email");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = String(formData.get("password"));

    const credentials =
      mode === "email"
        ? { email: String(formData.get("email")), password }
        : { schoolSlug: String(formData.get("schoolSlug")), admissionNumber: String(formData.get("admissionNumber")), password };

    startTransition(async () => {
      const result = await signIn("credentials", { ...credentials, redirect: false });
      if (result?.error) {
        setError(mode === "email" ? "Invalid email or password." : "Invalid school, admission number or password.");
        return;
      }
      const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-md bg-muted-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${mode === "email" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
        >
          Staff / Parent
        </button>
        <button
          type="button"
          onClick={() => setMode("student")}
          className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${mode === "student" ? "bg-surface text-foreground shadow-sm" : "text-muted"}`}
        >
          Student
        </button>
      </div>

      <form key={mode} onSubmit={handleSubmit} className="space-y-4">
        {mode === "email" ? (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@school.edu" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="schoolSlug">School</Label>
              <Input id="schoolSlug" name="schoolSlug" type="text" required placeholder="e.g. winfield-montessori-school" />
              <p className="text-xs text-muted">Ask your teacher if you don&apos;t know this.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admissionNumber">Admission Number</Label>
              <Input id="admissionNumber" name="admissionNumber" type="text" required placeholder="e.g. 2026-0054" />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required placeholder="••••••••" />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </div>
  );
}
