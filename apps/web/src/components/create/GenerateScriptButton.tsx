"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateScriptButton({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${episodeId}/script/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start screenplay generation.");
      router.push(`/projects/${projectId}?job=${data.generationJobId}&kind=script`);
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
        className="btn-secondary-sm font-medium"
      >
        {loading ? "Starting…" : "Generate Script"}
      </button>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
