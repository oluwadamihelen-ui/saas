"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateBibleButton({
  projectId,
  endpoint,
  kind,
  label,
}: {
  projectId: string;
  endpoint: string;
  kind: "characters" | "locations" | "props" | "storyboard";
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start generation.");
      router.push(`/projects/${projectId}?job=${data.generationJobId}&kind=${kind}`);
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
        className="rounded-full bg-cinerra-accent px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Starting…" : label}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
