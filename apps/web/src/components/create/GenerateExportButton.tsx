"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateExportButton({ episodeId, projectId, label = "Export Episode" }: { episodeId: string; projectId: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${episodeId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution: "720p" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start export.");
      router.push(`/projects/${projectId}?job=${data.generationJobId}&kind=export`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-cinerra-accent px-4 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <p className="max-w-[16rem] text-right text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
