"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function UnlockButton({
  scope,
  contentId,
  price,
  balance,
  label = "Unlock",
}: {
  scope: "MOVIE" | "EPISODE" | "SCENE";
  contentId: string;
  price: number;
  balance: number;
  label?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${scope}/${contentId}/unlock`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't unlock this.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock this.");
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-primary-sm">
        🪙 {price.toLocaleString()} — {label}
      </button>
    );
  }

  const insufficientCoins = balance < price;

  return (
    <div className="rounded-xl border border-cinerra-border bg-cinerra-surface p-4 text-sm">
      {insufficientCoins ? (
        <>
          <p className="font-medium text-cinerra-text">Not enough Doe</p>
          <p className="mt-1 text-cinerra-muted">
            You need 🪙 {price.toLocaleString()} — your balance is 🪙 {balance.toLocaleString()} ({(price - balance).toLocaleString()} more needed).
          </p>
          <Link href="/wallet" className="btn-primary-sm mt-3 inline-block">
            Buy Doe
          </Link>
        </>
      ) : (
        <>
          <p className="font-medium text-cinerra-text">{label}?</p>
          <p className="mt-1 text-cinerra-muted">
            Cost: 🪙 {price.toLocaleString()} · Your balance: 🪙 {balance.toLocaleString()} · After: 🪙 {(balance - price).toLocaleString()}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={handleConfirm} disabled={submitting} className="btn-primary-sm">
              {submitting ? "Unlocking…" : "Unlock & Watch"}
            </button>
            <button onClick={() => setConfirming(false)} className="btn-secondary-sm">
              Cancel
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
