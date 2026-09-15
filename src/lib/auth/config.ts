import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the auth config (no Prisma, no bcrypt) used by
 * middleware. The full config in `src/auth.ts` extends this with the
 * Credentials provider, which needs the Node.js runtime.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as { id: string; role: string; schoolId: string | null };
        token.id = u.id;
        token.role = u.role;
        token.schoolId = u.schoolId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.schoolId = (token.schoolId as string | null) ?? null;
      }
      return session;
    },
  },
};
