import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/// Shared visual content for every forbidden.tsx boundary (root,
/// dashboard, portal, platform). Deliberately takes a static href/label
/// rather than looking up the session itself — each boundary already
/// knows its own "go back" destination from its location in the route
/// tree, and calling a dynamic function (e.g. auth()) here would force
/// every route sharing this boundary to render dynamically, including
/// unrelated static marketing pages at the app root.
export function AccessDenied({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">You don&apos;t have access to this page</h1>
          <p className="text-sm text-muted">
            Your account doesn&apos;t have permission to view this. If you think this is a mistake, ask a school administrator to check your role.
          </p>
        </div>
        <Button asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
