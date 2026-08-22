"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateReferenceButton({
  entityType,
  entityId,
  projectId,
  hasReference,
}: {
  entityType: "characters" | "locations" | "wardrobes" | "props";
  entityId: string;
  projectId: string;
  hasReference: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${entityType}/${entityId}/reference/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start reference generation.");
      router.push(`/projects/${projectId}?job=${data.generationJobId}&kind=reference`);
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
        className="rounded-full border border-cinerra-border px-2.5 py-1 text-[11px] font-medium text-cinerra-text hover:border-cinerra-accent disabled:opacity-60"
      >
        {loading ? "Starting…" : hasReference ? "Regenerate Reference" : "Generate Reference"}
      </button>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
