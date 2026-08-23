"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function PublishButton({
  projectId,
  isPublished,
  eligible,
  ineligibleReason,
  publicationId,
  moderationStatus,
  moderationNotes,
}: {
  projectId: string;
  isPublished: boolean;
  eligible: boolean;
  ineligibleReason?: string;
  publicationId?: string;
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  moderationNotes?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/${isPublished ? "unpublish" : "publish"}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!isPublished && !eligible) {
    return <p className="max-w-[16rem] text-right text-[11px] text-cinerra-muted">{ineligibleReason}</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {isPublished && moderationStatus && <ModerationBadge status={moderationStatus} notes={moderationNotes} />}
      <div className="flex items-center gap-2">
        {isPublished && publicationId && (
          <Link href={`/watch/${publicationId}`} className="btn-secondary-sm">
            {moderationStatus === "APPROVED" ? "View public page" : "Preview"}
          </Link>
        )}
        <button onClick={handleClick} disabled={loading} className={isPublished ? "btn-secondary-sm" : "btn-primary-sm"}>
          {loading ? "Working…" : isPublished ? "Unpublish" : "Publish to Discover"}
        </button>
      </div>
      {error && <p className="max-w-[16rem] text-right text-[11px] text-red-300">{error}</p>}
    </div>
  );
}

function ModerationBadge({ status, notes }: { status: "PENDING" | "APPROVED" | "REJECTED"; notes?: string | null }) {
  if (status === "APPROVED") {
    return <span className="text-[11px] font-medium text-emerald-400">Live on Discover</span>;
  }
  if (status === "REJECTED") {
    return (
      <span className="max-w-[16rem] text-right text-[11px] text-red-300">
        Rejected{notes ? `: ${notes}` : "."} Publish again once fixed to resubmit.
      </span>
    );
  }
  return <span className="text-[11px] text-cinerra-gold">Pending review</span>;
}
