"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

/// Catches an error thrown while a Server or Client Component renders
/// (e.g. a requireX() permission check called directly at the top of a
/// page, rather than from a submitted form/action — those go through
/// withAuthErrors/useSafeAction instead and never reach this boundary).
/// Next redacts error.message for anything thrown during a Server
/// Component's render in production (only `digest` survives, matching
/// server-side logs) — so this can't reliably show *why* a page-load
/// error happened the way the action-level fixes do; it can only replace
/// Next's stock unstyled crash screen with a branded one and offer a way
/// back out. In development the real message still comes through, so it
/// shows there as a bonus.
export default function GlobalPageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const devMessage = process.env.NODE_ENV !== "production" ? error.message : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-navy-muted">{brand.name}</p>
      <h1 className="mt-4 text-xl font-semibold text-white">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-navy-muted">
        {devMessage || "We hit an unexpected error loading this page. It's on us — try again, or head back to the dashboard."}
      </p>
      {error.digest && <p className="mt-2 text-xs text-navy-muted/70">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button size="lg" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
