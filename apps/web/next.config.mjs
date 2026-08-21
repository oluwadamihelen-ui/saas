/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@cinerra/ai",
    "@cinerra/billing",
    "@cinerra/config",
    "@cinerra/database",
    "@cinerra/domain",
    "@cinerra/queue",
    "@cinerra/storage",
  ],
  eslint: { ignoreDuringBuilds: true },
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
