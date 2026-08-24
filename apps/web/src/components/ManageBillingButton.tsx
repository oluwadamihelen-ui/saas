"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManageBillingButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  async function handleClick() {
    if (!window.confirm("Cancel your subscription? You'll keep access until the current period ends.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setCancelled(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (cancelled) {
    return <p className="text-xs text-cinerra-muted">Cancellation requested — this can take a moment to confirm.</p>;
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className="btn-secondary-sm">
        {loading ? "Cancelling…" : "Cancel subscription"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
