"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/// Fires a success/error toast whenever a useActionState() result's status
/// transitions — the uniform `{ status: "idle" | "error" | "success" | ...;
/// message?: string }` shape every server action's state in this app
/// already returns. A ref (not comparing against the previous render's
/// state directly) tracks the last-seen status so this only fires once per
/// actual transition, not on every re-render while status stays the same.
/// A status this app doesn't use ("loading", etc. — a couple of AI
/// generation forms have one) is silently ignored, not an error.
export function useActionToast(state: { status: string; message?: string }) {
  const lastStatus = useRef(state.status);

  useEffect(() => {
    if (state.status === lastStatus.current) return;
    lastStatus.current = state.status;

    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state.status, state.message]);
}
