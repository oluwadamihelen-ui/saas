import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This is an npm-workspaces monorepo with Vercel's Root Directory set to
  // apps/school — Next's docs call out that in a monorepo, only files
  // under the Next.js project root are traced by default, and recommend
  // explicitly setting outputFileTracingRoot (to the monorepo root, where
  // the shared node_modules actually lives) alongside outputFileTracingIncludes.
  outputFileTracingRoot: path.join(__dirname, "../../"),
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
  // Lets requirePermission/requireSchoolUser/requireSuperAdmin (src/lib/auth/require.ts)
  // call the forbidden()/unauthorized() navigation APIs instead of throwing a
  // plain Error — which Next.js has no default boundary for, so it fell
  // through to the generic framework error page (a raw 500). These render
  // src/app/forbidden.tsx / unauthorized.tsx instead.
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
