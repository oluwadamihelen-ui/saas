"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SuspendUserForm() {
  const router = useRouter();
  const [targetUserEmail, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserEmail, action: "SUSPEND", reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't suspend that account.");
      setDone(true);
      setEmail("");
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't suspend that account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-cinerra-muted">
        User email
        <input
          type="email"
          value={targetUserEmail}
          onChange={(e) => {
            setEmail(e.target.value);
            setDone(false);
          }}
          required
          className="input mt-1 w-full"
        />
      </label>
      <label className="text-xs text-cinerra-muted">
        Reason (optional, kept in the audit log)
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="input mt-1 w-full" />
      </label>
      <div className="sm:col-span-2 mt-1 flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-md bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20">
          {saving ? "Suspending…" : "Suspend account"}
        </button>
        {done && <span className="text-xs text-emerald-400">Suspended.</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </form>
  );
}
