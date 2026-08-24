"use client";

import { useState } from "react";

interface CoinPackage {
  id: string;
  coins: number;
  bonusCoins: number;
  priceCents: number;
  currency: string;
}

type Provider = "PAYSTACK" | "KORAPAY";

const PROVIDER_LABEL: Record<Provider, string> = { PAYSTACK: "Paystack", KORAPAY: "Korapay" };

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function BuyCoinsGrid({ packages, availableProviders }: { packages: CoinPackage[]; availableProviders: Provider[] }) {
  const [provider, setProvider] = useState<Provider>(availableProviders[0]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(coinPackageId: string) {
    setError(null);
    setLoadingId(coinPackageId);
    try {
      const res = await fetch("/api/coins/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coinPackageId, provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout.");
      setLoadingId(null);
    }
  }

  return (
    <div>
      {availableProviders.length > 1 && (
        <div className="mb-3 flex gap-2">
          {availableProviders.map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              disabled={loadingId !== null}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                provider === p ? "bg-cinerra-accent text-white" : "bg-cinerra-surface text-cinerra-muted hover:text-cinerra-text"
              }`}
            >
              Pay with {PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => handleBuy(pkg.id)}
            disabled={loadingId !== null}
            className="card flex flex-col items-center gap-1 py-6 text-center transition hover:border-cinerra-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-2xl font-bold text-cinerra-text">🪙 {pkg.coins.toLocaleString()}</span>
            {pkg.bonusCoins > 0 && <span className="text-xs font-medium text-emerald-400">+{pkg.bonusCoins.toLocaleString()} bonus</span>}
            <span className="mt-2 text-sm text-cinerra-muted">{loadingId === pkg.id ? "Redirecting…" : formatPrice(pkg.priceCents, pkg.currency)}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
