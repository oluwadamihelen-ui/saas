"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DEMO_PASSWORD } from "@/lib/demo";

/// One click, real sign-in — same next-auth credentials flow the login
/// page uses, just with a fixed demo email/password instead of a typed
/// one. The password isn't a secret: this is a deliberately public sandbox
/// account seeded fresh by `npm run db:seed`, never real customer data.
export function DemoRoleButton({ email, label }: { email: string; label: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);
    const result = await signIn("credentials", { email, password: DEMO_PASSWORD, redirect: false });
    if (result?.error) {
      setError("Could not sign in to the demo right now — please try again.");
      setIsPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Button type="button" className="w-full" disabled={isPending} onClick={handleClick}>
        {isPending ? "Signing in..." : `Continue as ${label}`}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
