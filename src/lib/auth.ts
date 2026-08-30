import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const providers: NonNullable<NextAuthConfig["providers"]> = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !user.passwordHash) return null;
      if (user.isSuspended) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

// Google OAuth is optional — only registered when credentials are configured,
// so local/dev setups without Google keys don't crash on load.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { globalRole: true, isSuspended: true, name: true, email: true, image: true },
        });
        if (dbUser) {
          token.globalRole = dbUser.globalRole;
          token.isSuspended = dbUser.isSuspended;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.picture = dbUser.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.globalRole = (token.globalRole as string) ?? "USER";
        session.user.isSuspended = Boolean(token.isSuspended);
      }
      return session;
    },
    async signIn({ user }) {
      if ((user as { isSuspended?: boolean })?.isSuspended) return false;
      return true;
    },
  },
  secret: process.env.AUTH_SECRET,
});
