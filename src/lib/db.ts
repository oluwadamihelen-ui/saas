import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

// Next.js bundles this module into a webpack/turbopack chunk under
// .next/server/..., which rewrites `__dirname` to the chunk's own
// location. Prisma's generated client resolves its query engine binary
// relative to that same (now-wrong) `__dirname`, so on Vercel it searches
// .next/server/chunks instead of where the engine actually is --
// PrismaClientInitializationError even though `prisma generate` produced
// the binary and it's genuinely present in the deployment. Setting
// PRISMA_QUERY_ENGINE_LIBRARY short-circuits that broken auto-detection
// with a path resolved from `process.cwd()`, which Vercel's Node.js
// runtime keeps stable at the deployed function's root regardless of how
// the bundler mangled __dirname. Vercel's serverless functions run on an
// Amazon Linux (RHEL-family) base -- confirmed by the exact engine name
// ("rhel-openssl-3.0.x") Prisma itself reports needing at runtime.
if (process.env.VERCEL && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const enginePath = path.join(process.cwd(), "src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node");
  if (fs.existsSync(enginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
  }
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
