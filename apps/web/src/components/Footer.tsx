import Link from "next/link";
import { Logo } from "./Logo";

/** Lightweight site footer — legal links live here so they're reachable from every public-facing page. */
export function Footer() {
  return (
    <footer className="border-t border-cinerra-border/70 px-4 py-8 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo className="text-base" />
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-cinerra-muted">
          <Link href="/pricing" className="hover:text-cinerra-text">
            Pricing
          </Link>
          <Link href="/discover" className="hover:text-cinerra-text">
            Discover
          </Link>
          <Link href="/terms" className="hover:text-cinerra-text">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-cinerra-text">
            Privacy
          </Link>
        </nav>
        <p className="text-xs text-cinerra-muted">© {new Date().getFullYear()} Cinerra</p>
      </div>
    </footer>
  );
}
