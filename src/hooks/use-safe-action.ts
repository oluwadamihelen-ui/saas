"use client";

import { useTransition } from "react";
import { toast } from "sonner";

/// For a button that calls a fire-and-forget Server Action directly (one
/// that returns void and throws rather than the {status,message} shape
/// useActionState forms use) — every such call in this app used to be a
/// bare `startTransition(async () => { await action(); router.refresh(); })`
/// with nothing catching what the action throws. An UnauthorizedError or
/// ForbiddenError from a requireX() call (or any other error) would escape
/// the transition uncaught and crash past React into the generic "This
/// page couldn't load" screen instead of telling the user why. This is the
/// same fix as withAuthErrors (src/lib/auth/require.ts) for that call
/// shape: catch it here and show it as a toast instead.
export function useSafeAction() {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      }
    });
  }

  return [isPending, run] as const;
}
