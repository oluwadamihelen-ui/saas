"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FavoriteButton({ publicationId, initiallyFavorited }: { publicationId: string; initiallyFavorited: boolean }) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const optimistic = !favorited;
    setFavorited(optimistic);
    try {
      const res = await fetch(`/api/publications/${publicationId}/favorite`, { method: "POST" });
      if (!res.ok) {
        setFavorited(!optimistic);
        return;
      }
      const data = (await res.json()) as { favorited: boolean };
      setFavorited(data.favorited);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={
        favorited
          ? "btn-primary-sm gap-1.5"
          : "btn-secondary-sm gap-1.5"
      }
    >
      <BookmarkIcon filled={favorited} />
      {favorited ? "Saved" : "Save"}
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  );
}
