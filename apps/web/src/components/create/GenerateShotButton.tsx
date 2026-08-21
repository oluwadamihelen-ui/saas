"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateShotButton({ shotId, projectId, label = "Generate" }: { shotId: string; projectId: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shots/${shotId}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start video generation.");
      router.push(`/projects/${projectId}?job=${data.generationJobId}&kind=shot`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-cinerra-accent px-2.5 py-1 text-[11px] font-medium text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
