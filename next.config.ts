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

  // Baseline security headers — none of this app's pages are meant to be
  // framed by another site, and there's no legitimate cross-origin embed
  // use case (confirmed: no <iframe> anywhere in src). HSTS is safe to
  // always send: browsers only act on it over an actual HTTPS connection,
  // so it's a no-op in local http dev.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
