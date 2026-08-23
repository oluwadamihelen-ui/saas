"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateClipButton({
  episodeId,
  projectId,
  kind,
  label,
}: {
  episodeId: string;
  projectId: string;
  kind: "TRAILER" | "SOCIAL_CLIP";
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressKind = kind === "TRAILER" ? "trailer" : "socialClip";

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${episodeId}/clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start generation.");
      router.push(`/projects/${projectId}?job=${data.generationJobId}&kind=${progressKind}`);
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
        className="rounded-full border border-cinerra-border px-4 py-1.5 text-xs font-medium text-cinerra-text hover:border-cinerra-accent disabled:opacity-60"
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <p className="max-w-[16rem] text-right text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
