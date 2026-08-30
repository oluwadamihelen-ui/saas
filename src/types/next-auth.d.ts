import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      globalRole: string;
      isSuspended: boolean;
    } & DefaultSession["user"];
  }
}
