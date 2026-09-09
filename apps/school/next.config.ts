import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generated client lives at a custom `output` path
  // (src/generated/prisma) rather than the default node_modules/.prisma
  // location. Next.js's serverless file tracer doesn't reliably detect
  // Prisma's dynamically-loaded query engine binaries (the .so.node files)
  // from that custom path, so on Vercel they get silently dropped from the
  // deployed function bundle — every DB query then fails at runtime with
  // "could not locate the Query Engine", even though the build succeeds.
  // Forcing the whole generated directory into every route's trace fixes it.
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
