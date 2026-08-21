"use client";

import { useState } from "react";

export function CheckoutButton({ planKey, disabled }: { planKey: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, interval: "MONTH" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return <button disabled className="mt-6 rounded-full border border-cinerra-border py-2.5 text-sm font-semibold text-cinerra-muted">Current plan</button>;
  }

  return (
    <div className="mt-6">
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-full bg-cinerra-accent py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Subscribe"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
