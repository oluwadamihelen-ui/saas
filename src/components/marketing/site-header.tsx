"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#why-schoolum", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "#how-it-works", label: "Resources" },
];

/// A persistent frosted bar rather than the old transparent-at-top/
/// solid-on-scroll toggle — it needs to read well over the homepage's
/// dark navy hero AND every plain-light marketing page without knowing
/// which one it's on, so "always frosted" is the simplest thing that
/// works everywhere.
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="container-shell flex h-16 items-center justify-between sm:h-18">
        <Link href="/" className="shrink-0" onClick={() => setMobileOpen(false)}>
          <Logo height={30} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-muted-surface hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav className="container-shell flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted-surface"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
              <Button asChild variant="secondary" size="lg" onClick={() => setMobileOpen(false)}>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="lg" onClick={() => setMobileOpen(false)}>
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
