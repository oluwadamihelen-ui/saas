import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { edgeAuthConfig } from "@/server/auth/edge-config";

// Middleware runs on the Edge runtime, so it uses the edge-safe auth config
// (no Prisma/bcrypt) rather than the full Node config in server/auth/index.ts.
const { auth } = NextAuth(edgeAuthConfig);

const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/characters", "/assets", "/voices", "/music", "/templates", "/settings", "/billing"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
