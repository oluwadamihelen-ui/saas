import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/// Rendered whenever unauthorized() (next/navigation) is called — the
/// defense-in-depth path in requireUser() (src/lib/auth/require.ts) for a
/// session that's missing or expired. In normal use the middleware already
/// redirects a signed-out visitor to /login before any protected page
/// renders, so this is rarely seen in practice. Requires
/// experimental.authInterrupts in next.config.ts.
export default function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <LogIn className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">Sign in to continue</h1>
          <p className="text-sm text-muted">Your session has ended or you&apos;re not signed in. Sign in again to pick up where you left off.</p>
        </div>
        <Button asChild>
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    </div>
  );
}
