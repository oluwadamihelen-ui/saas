"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string | null;
  email: string;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export function MemberList({
  currentUserId,
  ownerId,
  members,
  pendingInvites,
}: {
  currentUserId: string;
  ownerId: string;
  members: Member[];
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = currentUserId === ownerId;

  async function handleRemove(userId: string) {
    setError(null);
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/studio/members/${userId}/remove`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't remove that member.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that member.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between rounded-lg border border-cinerra-border/60 px-3 py-2 text-sm">
          <div>
            <span className="text-cinerra-text">{member.name || member.email}</span>{" "}
            <span className="text-xs text-cinerra-muted">{member.id === ownerId ? "Owner" : "Member"}</span>
            <p className="text-xs text-cinerra-muted">{member.email}</p>
          </div>
          {(isOwner && member.id !== ownerId) || member.id === currentUserId ? (
            member.id === ownerId ? null : (
              <button
                onClick={() => handleRemove(member.id)}
                disabled={removingId === member.id}
                className="text-xs text-red-300 underline hover:text-red-200 disabled:opacity-40"
              >
                {removingId === member.id ? "Removing…" : member.id === currentUserId ? "Leave" : "Remove"}
              </button>
            )
          ) : null}
        </div>
      ))}

      {pendingInvites.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-cinerra-muted">Pending invites</p>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between rounded-lg border border-dashed border-cinerra-border/60 px-3 py-2 text-sm text-cinerra-muted">
              <span>{invite.email}</span>
              <span className="text-xs">Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
