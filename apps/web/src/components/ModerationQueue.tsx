"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface PendingPublication {
  id: string;
  projectTitle: string;
  creatorName: string;
  publishedAt: string;
}

export function ModerationQueue({ items }: { items: PendingPublication[] }) {
  const [pending, setPending] = useState(items);

  if (pending.length === 0) {
    return <p className="text-sm text-cinerra-muted">Nothing waiting on review.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-cinerra-border">
      {pending.map((item) => (
        <ModerationRow key={item.id} item={item} onResolved={() => setPending((prev) => prev.filter((p) => p.id !== item.id))} />
      ))}
    </div>
  );
}

function ModerationRow({ item, onResolved }: { item: PendingPublication; onResolved: () => void }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "APPROVED" | "REJECTED") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/publications/${item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: decision === "REJECTED" ? notes || undefined : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
      onResolved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cinerra-text">{item.projectTitle}</p>
          <p className="text-xs text-cinerra-muted">
            by {item.creatorName} · submitted {new Date(item.publishedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/watch/${item.id}`} target="_blank" className="btn-secondary-xs">
            Preview
          </Link>
          <button onClick={() => review("APPROVED")} disabled={loading} className="btn-primary-xs">
            Approve
          </button>
          <button
            onClick={() => setRejecting((v) => !v)}
            disabled={loading}
            className="rounded-full border border-red-500/40 px-2.5 py-1 text-[11px] font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      </div>
      {rejecting && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason (shown to the creator)"
            className="input flex-1 py-1.5 text-xs"
          />
          <button onClick={() => review("REJECTED")} disabled={loading} className="btn-secondary-xs shrink-0 border-red-500/40 text-red-300">
            Confirm reject
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
