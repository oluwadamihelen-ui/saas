import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config — no providers, no Prisma/bcrypt imports.
 * Used by middleware (which runs on the Edge runtime) to check session
 * tokens without pulling in Node-only dependencies. The full config in
 * config.ts extends this with the Credentials provider for Node routes.
 */
export const edgeAuthConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};
