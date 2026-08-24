"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [marking, setMarking] = useState(false);

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await fetch("/api/notifications/read", { method: "POST" });
      const now = new Date().toISOString();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-cinerra-border text-cinerra-muted transition hover:border-cinerra-accent/40 hover:text-cinerra-text"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-cinerra-border bg-cinerra-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-cinerra-border px-4 py-3">
              <p className="text-sm font-semibold text-cinerra-text">Notifications</p>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} disabled={marking} className="text-xs text-cinerra-accent hover:underline disabled:opacity-50">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-cinerra-muted">Nothing here yet.</p>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.linkUrl ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block border-b border-cinerra-border/60 px-4 py-3 text-sm transition last:border-0 hover:bg-cinerra-bg/50 ${!n.readAt ? "bg-cinerra-accent/5" : ""}`}
                  >
                    <p className="font-medium text-cinerra-text">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-cinerra-muted">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-cinerra-muted">{new Date(n.createdAt).toLocaleString()}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
