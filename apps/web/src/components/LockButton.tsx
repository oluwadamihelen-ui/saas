"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LockButton({ entityType, id, isLocked }: { entityType: "characters" | "locations"; id: string; isLocked: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/${entityType}/${id}/${isLocked ? "unlock" : "lock"}`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${
        isLocked ? "border-cinerra-accent bg-cinerra-accent/15 text-cinerra-text" : "border-cinerra-border text-cinerra-muted hover:text-cinerra-text"
      }`}
    >
      <LockIcon locked={isLocked} />
      {isLocked ? "Locked" : "Lock"}
    </button>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      {locked ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7-2.5" />}
    </svg>
  );
}
