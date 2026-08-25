import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@cinerra/database";
import { verifyPassword } from "@cinerra/config";
import { env } from "./env";
import { checkLoginRateLimit } from "./rateLimit";

const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      // Credential-stuffing/brute-force protection, keyed by the attempted
      // email rather than the caller's IP (a distributed attack targeting
      // one account would evade a per-IP limit). Returning null here reads
      // identically to a wrong password to the UI, which is deliberate —
      // it never confirms to a caller that they're being rate-limited.
      const { allowed } = await checkLoginRateLimit(email);
      if (!allowed) return null;

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user?.passwordHash) return null;
      if (!verifyPassword(password, user.passwordHash)) return null;
      if (user.status !== "ACTIVE") return null;

      return { id: user.id, email: user.email, name: user.name, image: user.avatarUrl };
    },
  }),
];

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }) as unknown as (typeof providers)[number],
  );
}

const { handlers, auth: uncachedAuth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
        // Re-checked on every session resolution (not just at login) so a
        // JWT issued before a suspension keeps working. Piggybacks on this
        // existing per-request lookup rather than adding a second one.
        const dbUser = await prisma.user.findUnique({ where: { id: token.userId as string }, select: { role: true, status: true } });
        (session.user as { role?: string }).role = dbUser?.role;
        (session.user as { status?: string }).status = dbUser?.status;
      }
      return session;
    },
  },
});

// The session callback above does a Prisma lookup on every call, and
// Header/Nav/most pages each call auth() independently in the same
// render — without this, a single page load re-runs that lookup 3-4
// times. React's cache() dedupes those into one per request.
export const auth = cache(uncachedAuth);
export { handlers, signIn, signOut };
