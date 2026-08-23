"use client";

import { useState } from "react";

export function DeleteAccountForm({ email, action }: { email: string; action: (formData: FormData) => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const matches = confirmText.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={action} onSubmit={() => setPending(true)} className="mt-4 flex flex-col gap-3 sm:max-w-sm">
      <label className="text-xs text-cinerra-muted">
        Type <span className="font-mono text-cinerra-text">{email}</span> to confirm.
      </label>
      <input
        name="confirmEmail"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={email}
        autoComplete="off"
        className="input"
      />
      <button type="submit" disabled={!matches || pending} className="btn-secondary-sm w-fit disabled:cursor-not-allowed disabled:opacity-40">
        {pending ? "Deleting…" : "Permanently delete my account"}
      </button>
    </form>
  );
}
