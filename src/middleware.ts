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

  // Neither req.nextUrl nor req.url can be trusted here: NextAuth's auth()
  // wrapper rebuilds both from the configured NEXTAUTH_URL/AUTH_URL origin
  // (confirmed by temporarily setting NEXTAUTH_URL to an arbitrary value
  // and watching a rewrite target pick it up verbatim, regardless of the
  // real incoming Host) — presumably a deliberate anti-host-header-injection
  // measure for anything wrapped in auth(), unaffected by trustHost. The
  // literal `Host` request header is the only value that still reflects
  // the real request.
  const requestHostname = (req.headers.get("host") ?? "").split(":")[0];
  const requestProtocol = req.headers.get("x-forwarded-proto") ?? "https";

  // On the demo subdomain, the root path shows the "pick a role, sign in
  // instantly" landing page instead of the normal marketing homepage —
  // everything else on that host (login, /dashboard, /portal, ...) behaves
  // exactly like the main site, since it's the same deployment.
  if (requestHostname === DEMO_HOSTNAME && pathname === "/") {
    // Built from the raw Host header text, not any URL derived from the
    // request object — see the note above for why.
    return NextResponse.rewrite(new URL(`${requestProtocol}://${requestHostname}/demo`));
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
    // Same Host-header-not-request-URL fix as the demo rewrite above —
    // this was quietly wrong on any host other than the configured
    // NEXTAUTH_URL/AUTH_URL origin too, just never visible before now (a
    // visitor on the bare apex domain already gets sent to www by
    // Vercel's own separate domain redirect, which happened to mask it).
    const loginUrl = new URL(`${requestProtocol}://${requestHostname}/login`);
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
