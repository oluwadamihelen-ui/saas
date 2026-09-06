import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";

const NAV_LINKS = [
  { href: "/apps", label: "Apps" },
  { href: "/categories", label: "Categories" },
  { href: "/services", label: "Services" },
  { href: "/domains", label: "Domains" },
  { href: "/hosting", label: "Hosting" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="container-shell flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
            F
          </span>
          <span className="text-lg font-semibold tracking-tight">Forgecart</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {session?.user ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={session.user.role === "SUPER_ADMIN" || session.user.role === "STAFF" ? "/admin" : "/dashboard"}>
                Dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link href="/login">Login</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/apps">Get Started</Link>
          </Button>
        </div>

        <MobileNav links={NAV_LINKS} isAuthenticated={Boolean(session?.user)} />
      </div>
    </header>
  );
}
