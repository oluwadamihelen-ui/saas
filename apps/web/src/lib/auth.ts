import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@cinerra/database";
import { verifyPassword } from "@cinerra/config";
import { env } from "./env";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        const dbUser = await prisma.user.findUnique({ where: { id: token.userId as string }, select: { role: true } });
        (session.user as { role?: string }).role = dbUser?.role;
      }
      return session;
    },
  },
});
