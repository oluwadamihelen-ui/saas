import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

/// Renders for every notFound() call across the app (including the
/// deliberate existence-hiding ones for cross-tenant/cross-teacher IDs —
/// see ARCHITECTURE.md — which intentionally give no more detail than
/// this) and for any URL that matches no route at all. Replaces Next's
/// unstyled stock 404 with something that reads as part of the product.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-navy-muted">{brand.name}</p>
      <h1 className="mt-4 text-6xl font-semibold tracking-tight text-white">404</h1>
      <h2 className="mt-3 text-xl font-semibold text-white">We couldn&apos;t find that page</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-navy-muted">
        The page you&apos;re looking for doesn&apos;t exist, may have moved, or you may not have access to it.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </div>
  );
}
