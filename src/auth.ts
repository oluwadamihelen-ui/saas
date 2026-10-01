import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth/config";
import { rateLimit } from "@/lib/rate-limit";

// A real hash so unknown-email logins cost the same as wrong-password ones.
const DUMMY_HASH = bcrypt.hashSync("riskpilot-dummy-password", 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password || password.length > 200) return null;
        if (!rateLimit(`login:${email}`, 8, 10 * 60_000).ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
