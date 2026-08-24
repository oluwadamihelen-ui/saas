"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WithdrawButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payouts/request", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't request a payout.");
      setRequested(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't request a payout.");
    } finally {
      setLoading(false);
    }
  }

  if (requested) {
    return <p className="text-xs text-emerald-400">Payout requested — check the history below for status.</p>;
  }

  return (
    <div>
      <button onClick={handleClick} disabled={disabled || loading} className="btn-primary-sm">
        {loading ? "Requesting…" : "Withdraw"}
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
