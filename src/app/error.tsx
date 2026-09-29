"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { logger } from "@/lib/security/logger";

// Next.js 16 renamed this boundary's recovery prop from `reset` to `retry`
// (see node_modules/next/dist/docs/.../file-conventions/error.md) -- using
// the old name would silently call `undefined()` when clicked.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    logger.error("app.unhandled_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Logo height={32} />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted">
          An unexpected error occurred. Try again, or head back to the dashboard -- your data is safe.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => retry()}>
          Try again
        </Button>
        <Button asChild>
          <Link href="/app">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
