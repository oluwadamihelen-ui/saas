import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config, shared by the full Node config (lib/auth.ts) and
 * by middleware.ts. Middleware runs on the Edge runtime, where Prisma
 * Client cannot execute — so this file must never import prisma or touch
 * the database. It only decodes/validates the session JWT and decides
 * route access; the Node-only config in lib/auth.ts adds providers,
 * the Prisma adapter, and the callbacks that enrich the token from the DB.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    // Edge-safe: only reads fields already embedded in the JWT by the
    // Node-only jwt callback (lib/auth.ts) — never touches Prisma, so this
    // also runs correctly inside middleware.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.globalRole = (token.globalRole as string) ?? "USER";
        session.user.isSuspended = Boolean(token.isSuspended);
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = ["/dashboard", "/onboarding", "/admin"];
      const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

      if (!isProtected) return true;
      if (!isLoggedIn) return false;

      if (pathname.startsWith("/admin")) {
        const role = auth?.user?.globalRole;
        return role === "ADMIN" || role === "SUPER_ADMIN";
      }

      return true;
    },
  },
  secret: process.env.AUTH_SECRET,
};
