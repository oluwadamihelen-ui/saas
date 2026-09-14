import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { brand } from "@/lib/brand";

const { auth } = NextAuth(authConfig);

/// The hostname a Buyer's "Open demo" link (and the pricing/apply pages'
/// own demo mentions) point to — this app now serves it directly (see
/// src/app/demo/page.tsx) rather than a separately hosted environment.
const DEMO_HOSTNAME = new URL(brand.demoUrl).hostname;

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // req.nextUrl.hostname does NOT reliably reflect the incoming Host
  // header in this Next.js version (confirmed: it resolves to the
  // server's own bind address, not the request's actual Host) — the
  // literal `Host` request header is the only accurate source for this.
  const requestHostname = (req.headers.get("host") ?? "").split(":")[0];

  // On the demo subdomain, the root path shows the "pick a role, sign in
  // instantly" landing page instead of the normal marketing homepage —
  // everything else on that host (login, /dashboard, /portal, ...) behaves
  // exactly like the main site, since it's the same deployment.
  if (requestHostname === DEMO_HOSTNAME && pathname === "/") {
    return NextResponse.rewrite(new URL("/demo", req.nextUrl));
  }

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/platform") ||
    pathname === "/partner" ||
    pathname.startsWith("/partner/") ||
    pathname === "/buyer" ||
    pathname.startsWith("/buyer/");

  if (!isProtected) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // "/" added solely so the demo-subdomain rewrite above can run there —
  // every other unprotected marketing path is left alone, matching the
  // isProtected check's own scope exactly.
  matcher: ["/", "/dashboard/:path*", "/onboarding/:path*", "/portal/:path*", "/platform/:path*", "/partner", "/partner/:path*", "/buyer", "/buyer/:path*"],
};
