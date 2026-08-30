import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Middleware runs on the Edge runtime, so it uses the edge-safe config
 * (no Prisma adapter/providers) — see lib/auth.config.ts. Route
 * protection is expressed via the shared `authorized` callback so the
 * same rules apply here and don't drift from lib/auth.ts.
 */
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/admin/:path*"],
};
