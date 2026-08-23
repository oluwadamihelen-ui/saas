/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@cinerra/ai",
    "@cinerra/billing",
    "@cinerra/config",
    "@cinerra/database",
    "@cinerra/domain",
    "@cinerra/email",
    "@cinerra/queue",
    "@cinerra/storage",
  ],
  eslint: { ignoreDuringBuilds: true },
  // Enables instrumentation.ts, which initializes Sentry once at server
  // startup when SENTRY_DSN is set. Stable without this flag as of
  // Next.js 15 — still required to opt in on 14.x.
  experimental: { instrumentationHook: true },
  webpack: (config) => {
    // Workspace packages use explicit ".js" extensions on relative imports
    // (required for Node ESM once compiled — see apps/worker's tsc build).
    // Since they're consumed here as raw TypeScript via transpilePackages,
    // teach webpack to resolve those ".js" specifiers back to ".ts" source.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
