"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function RequestResetForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [devNote, setDevNote] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    const data = await res.json().catch(() => ({}));

    setStatus("sent");
    if (data.devResetUrl) {
      setDevResetUrl(data.devResetUrl);
      setDevNote(data.devNote);
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 text-sm">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </div>
        {devResetUrl && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
            <p className="font-semibold text-warning">Development mode</p>
            <p className="mt-1 text-muted-foreground">{devNote}</p>
            <Link href={devResetUrl} className="mt-2 inline-block break-all font-medium text-brand-600 underline">
              {devResetUrl}
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <Button type="submit" disabled={status === "loading"} className="w-full">
        {status === "loading" ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
