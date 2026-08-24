import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client instance per process. In dev, Next.js hot
 * reload would otherwise spawn a new client (and a new connection pool) on
 * every edit, so we stash it on globalThis.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export * from "./wallet.js";
export * from "./promotionalGrants.js";
