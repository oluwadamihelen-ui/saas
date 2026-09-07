import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/security/logger";
import { authConfig } from "@/lib/auth/config";
import { checkRateLimit } from "@/lib/security/rate-limit";

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;

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

        // Rate limit by email, not IP -- protects a single account from
        // credential-stuffing/brute force regardless of how distributed the
        // attempt source is. Checked (and counted) even before the password
        // is verified, so a flood of guesses against one address is capped
        // whether or not any of them are close.
        const rateLimit = await checkRateLimit(`login:${email}`, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_SECONDS);
        if (!rateLimit.allowed) {
          logger.warn("auth.login_rate_limited", { email, count: rateLimit.count });
          return null;
        }

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
