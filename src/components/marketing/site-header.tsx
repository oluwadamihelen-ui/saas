import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/**
 * Shared header for every public marketing page (home, about, contact,
 * privacy, terms). Checks the session itself so a signed-in visitor who
 * reopens the site sees "Go to dashboard" instead of "Sign in" -- these
 * pages used to render Sign in/Register unconditionally, which made an
 * already-logged-in account look logged out.
 */
export async function SiteHeader({ extraNav, sticky = false }: { extraNav?: ReactNode; sticky?: boolean }) {
  const session = await auth();
  const dashboardHref = session?.user ? (session.user.isSuperAdmin ? "/super" : "/app") : null;

  return (
    <header className={`${sticky ? "sticky top-0 z-30 bg-surface/95 backdrop-blur" : "bg-surface"} border-b border-border`}>
      <div className="container-shell flex h-16 items-center justify-between">
        <Link href="/">
          <Logo height={30} />
        </Link>
        {extraNav}
        <div className="flex items-center gap-3">
          {dashboardHref ? (
            <Button asChild size="sm">
              <Link href={dashboardHref}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Register your hotel</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
