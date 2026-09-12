import fs from "fs";
import path from "path";
import { PrismaClient } from "@/generated/prisma/client";

/// Prisma's own query-engine auto-detection (for this project's
/// combination of the newer `prisma-client` generator, a custom output
/// path, and a monorepo deployed to Vercel) resolves a path baked in at
/// build time (under /vercel/path0 or /ROOT) that doesn't match the
/// actual Lambda runtime filesystem (/var/task) — confirmed by directly
/// inspecting the deployed function: the engine file is really there,
/// right next to this generated client, just not where Prisma's own
/// lookup expects it. Finding it via process.cwd() (which does resolve
/// correctly at runtime) and setting PRISMA_QUERY_ENGINE_LIBRARY
/// explicitly bypasses that broken auto-detection. Runs once per cold
/// start; a no-op if the var is already set or the directory can't be
/// read (falls back to Prisma's own detection, same as before).
///
/// The generated directory can hold engines for more than one platform
/// at once (this schema's binaryTargets lists both "native" and
/// "rhel-openssl-3.0.x", so a local Windows/macOS dev install and a
/// Linux deploy target sit side by side) — the filename's extension is
/// platform-specific (.dll.node / .dylib.node / .so.node), so matching
/// on that picks the one this process can actually load instead of
/// whichever sorts first.
const ENGINE_EXTENSION_BY_PLATFORM: Partial<Record<NodeJS.Platform, string>> = {
  win32: ".dll.node",
  darwin: ".dylib.node",
  linux: ".so.node",
};
if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  try {
    const generatedDir = path.join(process.cwd(), "src/generated/prisma");
    const wantExtension = ENGINE_EXTENSION_BY_PLATFORM[process.platform];
    const engineFile = fs
      .readdirSync(generatedDir)
      .find((f) => f.includes("query_engine") && (wantExtension ? f.endsWith(wantExtension) : f.endsWith(".node")));
    if (engineFile) process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(generatedDir, engineFile);
  } catch {
    // Leave Prisma's own detection to run (and potentially fail) as before.
  }
}

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
