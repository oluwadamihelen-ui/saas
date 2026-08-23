"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApproveReferenceButton({ entityType, referenceId }: { entityType: "character-references" | "location-references"; referenceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/${entityType}/${referenceId}/approve`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-primary-xs"
    >
      {loading ? "Approving…" : "Approve"}
    </button>
  );
}
