import Link from "next/link";
import { auth } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { getRecentNotifications } from "@/lib/notifications";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";

/** Header (spec §8): logo, search, notifications, create button, profile. */
export async function Header() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
  const [balance, { notifications, unreadCount }] = user?.id
    ? await Promise.all([getWalletBalance(user.id), getRecentNotifications(user.id)])
    : [null, { notifications: [], unreadCount: 0 }];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cinerra-border/70 bg-cinerra-bg/80 px-4 shadow-[0_1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-md md:px-8">
      <div className="flex items-center gap-8">
        <Link href="/" className="transition hover:opacity-90">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 rounded-full border border-cinerra-border bg-cinerra-surface/80 px-4 py-2 text-sm text-cinerra-muted transition focus-within:border-cinerra-accent/50 md:flex md:w-80">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search your movies…"
            className="w-full bg-transparent text-cinerra-text placeholder:text-cinerra-muted focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link href="/projects/new" className="btn-primary-sm hidden md:inline-flex">
              + Create
            </Link>
            <Link
              href="/wallet"
              className="flex h-9 items-center gap-1.5 rounded-full border border-cinerra-border bg-cinerra-surface/80 px-3 text-sm font-medium text-cinerra-text transition hover:border-cinerra-accent/40"
              title="Coin wallet"
            >
              🪙 {(balance ?? 0).toLocaleString()}
            </Link>
            <NotificationBell
              initialNotifications={notifications.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                linkUrl: n.linkUrl,
                readAt: n.readAt ? n.readAt.toISOString() : null,
                createdAt: n.createdAt.toISOString(),
              }))}
              initialUnreadCount={unreadCount}
            />
            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-cinerra-accent text-sm font-semibold uppercase text-white ring-2 ring-cinerra-bg transition hover:brightness-110"
              title="Your profile"
            >
              {user.name?.[0] ?? user.email?.[0] ?? "U"}
            </Link>
          </>
        ) : (
          <Link href="/login" className="btn-secondary px-4 py-2 text-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2 shrink-0">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
