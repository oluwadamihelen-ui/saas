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
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
        token.hotelId = (user as { hotelId?: string | null }).hotelId ?? null;
        token.hotelName = (user as { hotelName?: string | null }).hotelName ?? null;
        token.hotelCurrency = (user as { hotelCurrency?: string | null }).hotelCurrency ?? null;
      }
      // Supports switching between hotels for users with more than one
      // HotelMember (a hotel group owner/manager). The client calls
      // useSession().update({ hotelId, hotelName, role, hotelCurrency })
      // after the server has verified the target membership belongs to
      // this user -- see lib/auth/hotel.ts switchActiveHotel().
      if (trigger === "update" && session) {
        const patch = session as Partial<{ hotelId: string; hotelName: string; role: string; hotelCurrency: string }>;
        if (patch.hotelId) token.hotelId = patch.hotelId;
        if (patch.hotelName) token.hotelName = patch.hotelName;
        if (patch.role) token.role = patch.role;
        if (patch.hotelCurrency) token.hotelCurrency = patch.hotelCurrency;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
        session.user.hotelId = (token.hotelId as string | null) ?? null;
        session.user.hotelName = (token.hotelName as string | null) ?? null;
        session.user.hotelCurrency = (token.hotelCurrency as string | null) ?? null;
      }
      return session;
    },
  },
};
