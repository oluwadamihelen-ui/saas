"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RiskUserActions({ email, accountStatus }: { email: string; accountStatus: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = accountStatus === "SUSPENDED";

  async function toggle() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserEmail: email, action: suspended ? "UNSUSPEND" : "SUSPEND" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't update account status.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update account status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={suspended ? "btn-secondary-sm" : "rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20"}
      >
        {saving ? "Working…" : suspended ? "Unsuspend" : "Suspend"}
      </button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
