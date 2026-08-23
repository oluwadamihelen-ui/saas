"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-cinerra-muted">
        Display name
        <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} required className="input" />
      </label>
      <button type="submit" disabled={loading || name === initialName} className="btn-secondary-sm">
        {loading ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-xs text-emerald-400">Saved.</span>}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </form>
  );
}
