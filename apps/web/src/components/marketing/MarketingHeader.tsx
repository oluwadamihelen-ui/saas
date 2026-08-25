import Link from "next/link";

/** Logged-out landing page header — light "rewards" theme, separate from the in-app Header. */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rewards-border/70 bg-rewards-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rewards-orange shadow-rewards-glow">
            <ClapperGlyph />
          </span>
          <span className="font-display text-lg font-bold leading-none tracking-tight text-rewards-ink">
            Cinerra
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-rewards-muted md:flex">
          <Link href="/discover" className="transition hover:text-rewards-ink">
            Discover
          </Link>
          <Link href="/pricing" className="transition hover:text-rewards-ink">
            Pricing
          </Link>
          <Link href="/studio" className="transition hover:text-rewards-ink">
            Studio
          </Link>
          <Link href="/login" className="transition hover:text-rewards-ink">
            Sign in
          </Link>
        </nav>

        <Link href="/signup" className="rewards-btn-dark px-5 py-2.5 text-xs md:px-6 md:py-3 md:text-sm">
          Get Started <ArrowIcon />
        </Link>
      </div>
    </header>
  );
}

function ClapperGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
      <path d="M3 8h18v12H3z" />
      <path d="M3 8l3-5h3l-3 5zM9 8l3-5h3l-3 5zM15 8l3-5h3l-3 5z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
