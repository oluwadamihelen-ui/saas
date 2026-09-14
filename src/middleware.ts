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
    // Built from req.url (the raw incoming request URL), not req.nextUrl —
    // req.nextUrl's origin is subject to the exact same unreliability as
    // its .hostname above. Using it here produced a rewrite target on the
    // wrong origin, which Vercel can't apply as an invisible same-origin
    // rewrite, so it silently turned into a visible cross-domain redirect.
    return NextResponse.rewrite(new URL("/demo", req.url));
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
    // Same req.url-not-req.nextUrl fix as the demo rewrite above — this
    // was quietly wrong on any host other than the canonical one too, just
    // never visible before now (an apex-domain visitor already gets
    // redirected to www by Vercel's own domain redirect, which happened
    // to mask it).
    const loginUrl = new URL("/login", req.url);
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
