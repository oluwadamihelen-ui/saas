"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  publisherRevenueShareBps: number;
  settlementPeriodDays: number;
  payoutMinimumCoins: number;
  payoutCoinValueCents: number;
  payoutCurrency: string;
  minMovieCoinPrice: number;
  maxMovieCoinPrice: number;
  minEpisodeCoinPrice: number;
  maxEpisodeCoinPrice: number;
  minSceneCoinPrice: number;
  maxSceneCoinPrice: number;
  doeCostPerReferenceImage: number;
  doeCostPerVideoSecond: number;
}

const FIELDS: { key: keyof Settings; label: string; type: "number" | "text" }[] = [
  { key: "publisherRevenueShareBps", label: "Publisher revenue share (basis points, 5000 = 50%)", type: "number" },
  { key: "settlementPeriodDays", label: "Settlement hold (days)", type: "number" },
  { key: "payoutMinimumCoins", label: "Minimum payout (Doe)", type: "number" },
  { key: "payoutCoinValueCents", label: "Payout rate (cents per Doe)", type: "number" },
  { key: "payoutCurrency", label: "Payout currency (e.g. NGN)", type: "text" },
  { key: "minMovieCoinPrice", label: "Movie price — min (Doe)", type: "number" },
  { key: "maxMovieCoinPrice", label: "Movie price — max (Doe)", type: "number" },
  { key: "minEpisodeCoinPrice", label: "Episode price — min (Doe)", type: "number" },
  { key: "maxEpisodeCoinPrice", label: "Episode price — max (Doe)", type: "number" },
  { key: "minSceneCoinPrice", label: "Scene price — min (Doe)", type: "number" },
  { key: "maxSceneCoinPrice", label: "Scene price — max (Doe)", type: "number" },
  { key: "doeCostPerReferenceImage", label: "Generation cost — reference image (Doe)", type: "number" },
  { key: "doeCostPerVideoSecond", label: "Generation cost — video, per second (Doe)", type: "number" },
];

export function PlatformSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [values, setValues] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(key: keyof Settings, raw: string) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: key === "payoutCurrency" ? raw : Number(raw) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save settings.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <label key={f.key} className="text-xs text-cinerra-muted">
          {f.label}
          <input
            type={f.type}
            value={values[f.key]}
            onChange={(e) => update(f.key, e.target.value)}
            className="input mt-1 w-full"
          />
        </label>
      ))}
      <div className="sm:col-span-2 mt-2 flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary-sm">
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </form>
  );
}
