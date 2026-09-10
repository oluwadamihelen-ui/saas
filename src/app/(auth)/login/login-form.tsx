"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = React.useState(false);

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
              <Input id="schoolSlug" name="schoolSlug" type="text" required placeholder="e.g. horizon-academy" />
              <p className="text-xs text-muted">Ask your teacher if you don&apos;t know this.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admissionNumber">Admission Number</Label>
              <Input id="admissionNumber" name="admissionNumber" type="text" required placeholder="e.g. 2026-0054" />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <a href="/help" className="text-xs font-medium text-accent hover:underline">
              Forgot password?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
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
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </div>
  );
}
