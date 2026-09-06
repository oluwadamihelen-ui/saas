import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/security/logger";
import { authConfig } from "@/lib/auth/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });

        if (!user || !user.passwordHash || user.status !== "ACTIVE") {
          logger.warn("auth.login_failed", { email, reason: !user ? "not_found" : "inactive_or_no_password" });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          logger.warn("auth.login_failed", { email, reason: "bad_password" });
          return null;
        }

        logger.info("auth.login_success", { userId: user.id, role: user.role.key });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.key,
        };
      },
    }),
  ],
});
