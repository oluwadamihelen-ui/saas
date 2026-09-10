import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      isSuperAdmin: boolean;
      hotelId: string | null;
      hotelName: string | null;
      hotelCurrency: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    isSuperAdmin?: boolean;
    hotelId?: string | null;
    hotelName?: string | null;
    hotelCurrency?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isSuperAdmin?: boolean;
    hotelId?: string | null;
    hotelName?: string | null;
    hotelCurrency?: string | null;
  }
}
