"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:max-w-xs">
      <input
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => { setCurrentPassword(e.target.value); setSaved(false); }}
        required
        className="input"
      />
      <input
        type="password"
        placeholder="New password (min. 8 characters)"
        value={newPassword}
        onChange={(e) => { setNewPassword(e.target.value); setSaved(false); }}
        required
        minLength={8}
        className="input"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="btn-secondary-sm">
          {loading ? "Updating…" : "Update password"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Password updated.</span>}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
