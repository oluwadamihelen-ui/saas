"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteMemberForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/studio/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send that invite.");
      setEmail("");
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:max-w-sm">
      <input
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setSent(false);
        }}
        placeholder="teammate@example.com"
        required
        disabled={disabled}
        className="input"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={disabled || submitting} className="btn-secondary-sm w-fit disabled:cursor-not-allowed disabled:opacity-40">
          {submitting ? "Sending…" : "Send invite"}
        </button>
        {sent && <span className="text-xs text-emerald-400">Invite sent.</span>}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
