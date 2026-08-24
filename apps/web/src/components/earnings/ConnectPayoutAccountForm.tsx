"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "PAYSTACK" | "KORAPAY";

export function ConnectPayoutAccountForm({ availableProviders }: { availableProviders: Provider[] }) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>(availableProviders[0]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payouts/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, bankCode, accountNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't connect that account.");
      setConfirmedName(data.accountName);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect that account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-cinerra-text">Connect a payout account</h3>
      {availableProviders.length > 1 && (
        <div className="flex gap-2">
          {availableProviders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                provider === p ? "bg-cinerra-accent text-white" : "bg-cinerra-surface text-cinerra-muted hover:text-cinerra-text"
              }`}
            >
              {p === "PAYSTACK" ? "Paystack" : "Korapay"}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Bank code"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          required
          className="input"
        />
        <input
          type="text"
          placeholder="Account number"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          required
          className="input"
        />
      </div>
      <button type="submit" disabled={loading} className="btn-secondary-sm">
        {loading ? "Verifying…" : "Verify and connect"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {confirmedName && <p className="text-xs text-emerald-400">Connected — verified account holder: {confirmedName}</p>}
    </form>
  );
}
