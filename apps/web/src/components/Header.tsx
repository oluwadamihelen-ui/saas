import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Logo } from "./Logo";

/** Header (spec §8): logo, search, notifications, create button, profile. */
export async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cinerra-border bg-cinerra-bg/90 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-8">
        <Link href="/">
          <Logo />
        </Link>
        <div className="hidden items-center gap-1 rounded-full border border-cinerra-border bg-cinerra-surface px-4 py-2 text-sm text-cinerra-muted md:flex md:w-80">
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
            <Link
              href="/projects/new"
              className="hidden rounded-full bg-cinerra-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 md:block"
            >
              + Create
            </Link>
            <button className="hidden h-9 w-9 items-center justify-center rounded-full border border-cinerra-border text-cinerra-muted hover:text-cinerra-text md:flex" aria-label="Notifications">
              <BellIcon />
            </button>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-cinerra-surface2 text-sm font-semibold uppercase text-cinerra-text" title="Sign out">
                {user.name?.[0] ?? user.email?.[0] ?? "U"}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="rounded-full border border-cinerra-border px-4 py-2 text-sm text-cinerra-text">
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

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
