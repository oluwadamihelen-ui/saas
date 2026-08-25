import Link from "next/link";

/** Logged-out landing page footer, ending in a large watermark band matching the reference brand style. */
export function MarketingFooter() {
  return (
    <footer className="bg-rewards-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 md:flex-row md:justify-between md:px-8">
        <div className="max-w-xs">
          <span className="font-display text-lg font-bold text-rewards-ink">Cinerra</span>
          <p className="mt-3 text-sm text-rewards-muted">
            Create, publish, and earn from AI-generated movies — start to finish, in one studio.
          </p>
          <Link href="/signup" className="rewards-btn-dark mt-5 inline-flex px-5 py-2.5 text-xs">
            Get Started <ArrowIcon />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div>
            <p className="font-bold text-rewards-ink">Navigation</p>
            <div className="mt-3 flex flex-col gap-2 text-rewards-muted">
              <Link href="/discover" className="hover:text-rewards-ink">Discover</Link>
              <Link href="/pricing" className="hover:text-rewards-ink">Pricing</Link>
              <Link href="/studio" className="hover:text-rewards-ink">Studio</Link>
            </div>
          </div>
          <div>
            <p className="font-bold text-rewards-ink">Account</p>
            <div className="mt-3 flex flex-col gap-2 text-rewards-muted">
              <Link href="/login" className="hover:text-rewards-ink">Sign in</Link>
              <Link href="/signup" className="hover:text-rewards-ink">Create account</Link>
            </div>
          </div>
          <div>
            <p className="font-bold text-rewards-ink">Legal</p>
            <div className="mt-3 flex flex-col gap-2 text-rewards-muted">
              <Link href="/terms" className="hover:text-rewards-ink">Terms</Link>
              <Link href="/privacy" className="hover:text-rewards-ink">Privacy</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden bg-rewards-band pt-10">
        <p
          aria-hidden
          className="select-none whitespace-nowrap text-center text-[16vw] font-extrabold leading-none text-white/25 md:text-[9rem]"
        >
          CINERRA
        </p>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 border-t border-white/20 px-4 py-5 text-xs text-white/90 sm:flex-row md:px-8">
          <span>Cinerra © {new Date().getFullYear()}</span>
          <span>All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
