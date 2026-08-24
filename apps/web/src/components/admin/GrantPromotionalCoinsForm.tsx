"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GrantPromotionalCoinsForm() {
  const router = useRouter();
  const [targetUserEmail, setEmail] = useState("");
  const [coins, setCoins] = useState(100);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/promotional-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserEmail, coins, expiresInDays, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't grant coins.");
      setGranted(true);
      setEmail("");
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't grant coins.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-cinerra-muted sm:col-span-2">
        User email
        <input type="email" value={targetUserEmail} onChange={(e) => { setEmail(e.target.value); setGranted(false); }} required className="input mt-1 w-full" />
      </label>
      <label className="text-xs text-cinerra-muted">
        Coins
        <input type="number" min={1} value={coins} onChange={(e) => setCoins(Number(e.target.value))} className="input mt-1 w-full" />
      </label>
      <label className="text-xs text-cinerra-muted">
        Expires in (days)
        <input type="number" min={1} value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} className="input mt-1 w-full" />
      </label>
      <label className="text-xs text-cinerra-muted sm:col-span-2">
        Reason (optional, shown to the creator/viewer)
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="input mt-1 w-full" />
      </label>
      <div className="sm:col-span-2 mt-2 flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary-sm">
          {saving ? "Granting…" : "Grant coins"}
        </button>
        {granted && <span className="text-xs text-emerald-400">Granted.</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </form>
  );
}
