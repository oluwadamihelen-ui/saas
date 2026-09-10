import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/security/logger";
import { authConfig } from "@/lib/auth/config";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        hotelId: { label: "Hotel", type: "text" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        const requestedHotelId = credentials?.hotelId ? String(credentials.hotelId) : undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: { include: { hotel: true }, orderBy: { createdAt: "asc" } },
          },
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

        if (user.isSuperAdmin) {
          logger.info("auth.login_success", { userId: user.id, role: "SUPER_ADMIN" });
          return { id: user.id, email: user.email, name: user.name, role: "SUPER_ADMIN", isSuperAdmin: true, hotelId: null, hotelName: null, hotelCurrency: null };
        }

        const activeMemberships = user.memberships.filter((m) => m.employmentStatus === "ACTIVE" && (m.hotel.status === "ACTIVE" || m.hotel.status === "TRIAL"));
        if (activeMemberships.length === 0) {
          logger.warn("auth.login_failed", { email, reason: "no_active_hotel_membership" });
          return null;
        }

        const membership =
          (requestedHotelId ? activeMemberships.find((m) => m.hotelId === requestedHotelId) : undefined) ??
          activeMemberships.find((m) => m.hotelId === user.primaryHotelId) ??
          activeMemberships[0];

        logger.info("auth.login_success", { userId: user.id, role: membership.role, hotelId: membership.hotelId });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: membership.role,
          isSuperAdmin: false,
          hotelId: membership.hotelId,
          hotelName: membership.hotel.name,
          hotelCurrency: membership.hotel.currency,
        };
      },
    }),
  ],
});
