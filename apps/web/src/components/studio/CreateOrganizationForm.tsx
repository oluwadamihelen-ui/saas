"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/studio/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't create your studio.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your studio.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:max-w-sm">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Horizon Pictures" maxLength={80} required className="input" />
      <button type="submit" disabled={submitting} className="btn-primary-sm w-fit">
        {submitting ? "Creating…" : "Create studio"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
