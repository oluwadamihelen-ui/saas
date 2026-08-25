"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Episode {
  id: string;
  number: number;
  title: string;
  coinPrice: number | null;
}

interface Settings {
  publisherRevenueShareBps: number;
  minMovieCoinPrice: number;
  maxMovieCoinPrice: number;
  minEpisodeCoinPrice: number;
  maxEpisodeCoinPrice: number;
}

function shareOf(price: number, bps: number) {
  const publisherShare = Math.floor((price * bps) / 10000);
  return { publisherShare, platformShare: price - publisherShare };
}

export function MonetizationSettings({
  projectId,
  episodes,
  initialMode,
  initialScope,
  initialCoinPrice,
}: {
  projectId: string;
  episodes: Episode[];
  initialMode: "FREE" | "PAID";
  initialScope: "MOVIE" | "EPISODE" | "SCENE" | null;
  initialCoinPrice: number | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<"FREE" | "PAID">(initialMode);
  const [scope, setScope] = useState<"MOVIE" | "EPISODE">(initialScope === "EPISODE" ? "EPISODE" : "MOVIE");
  const [moviePrice, setMoviePrice] = useState<number>(initialCoinPrice ?? 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/platform-settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/monetization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "FREE" ? { mode: "FREE" } : { mode: "PAID", scope, coinPrice: scope === "MOVIE" ? moviePrice : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save monetization settings.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save monetization settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEpisodePrice(episodeId: string, coinPrice: number) {
    setError(null);
    try {
      const res = await fetch(`/api/episodes/${episodeId}/monetization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coinPrice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that episode's price.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that episode's price.");
    }
  }

  const preview = settings ? shareOf(moviePrice, settings.publisherRevenueShareBps) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-full border border-cinerra-border bg-cinerra-bg p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("FREE")}
          className={`flex-1 rounded-full py-1.5 font-medium transition ${mode === "FREE" ? "bg-cinerra-accent text-white" : "text-cinerra-muted"}`}
        >
          Free
        </button>
        <button
          type="button"
          onClick={() => setMode("PAID")}
          className={`flex-1 rounded-full py-1.5 font-medium transition ${mode === "PAID" ? "bg-cinerra-accent text-white" : "text-cinerra-muted"}`}
        >
          Paid
        </button>
      </div>

      {mode === "PAID" && (
        <>
          <div>
            <label className="mb-2 block text-xs font-medium text-cinerra-muted">Charge viewers by</label>
            <div className="flex gap-2">
              {(["MOVIE", "EPISODE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    scope === s ? "border-cinerra-accent bg-cinerra-accent/20 text-cinerra-text" : "border-cinerra-border text-cinerra-muted"
                  }`}
                >
                  {s === "MOVIE" ? "Whole Movie" : "Per Episode"}
                </button>
              ))}
            </div>
          </div>

          {scope === "MOVIE" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-cinerra-muted">
                Episode Price {settings && `(${settings.minMovieCoinPrice}–${settings.maxMovieCoinPrice} suggested)`}
              </label>
              <input
                type="number"
                value={moviePrice}
                onChange={(e) => setMoviePrice(Number(e.target.value))}
                min={settings?.minMovieCoinPrice ?? 1}
                max={settings?.maxMovieCoinPrice}
                className="input w-32"
              />
              {preview && (
                <p className="mt-2 text-xs text-cinerra-muted">
                  Viewer pays 🪙 {moviePrice.toLocaleString()} · You earn 🪙 {preview.publisherShare.toLocaleString()} · FilmDoe earns 🪙{" "}
                  {preview.platformShare.toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-cinerra-muted">
                Per-episode prices {settings && `(${settings.minEpisodeCoinPrice}–${settings.maxEpisodeCoinPrice} suggested)`}
              </label>
              <div className="flex flex-col gap-2">
                {episodes.map((ep) => (
                  <EpisodePriceRow key={ep.id} episode={ep} settings={settings} onSave={(price) => handleEpisodePrice(ep.id, price)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-secondary-sm w-fit">
          {saving ? "Saving…" : "Save monetization"}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

function EpisodePriceRow({ episode, settings, onSave }: { episode: Episode; settings: Settings | null; onSave: (price: number) => void }) {
  const [price, setPrice] = useState(episode.coinPrice ?? settings?.minEpisodeCoinPrice ?? 10);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-cinerra-border/60 px-3 py-2 text-sm">
      <span>
        Ep {episode.number} — {episode.title}
      </span>
      <div className="flex items-center gap-2">
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={settings?.minEpisodeCoinPrice ?? 1} className="input w-20" />
        <button type="button" onClick={() => onSave(price)} className="btn-secondary-sm">
          {episode.coinPrice != null ? "Update" : "Set"}
        </button>
      </div>
    </div>
  );
}
