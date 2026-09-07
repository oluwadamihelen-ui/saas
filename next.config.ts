import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ssh2 (via node-ssh, used by the SSH deployment adapter) ships a
  // non-ESM-placeable asset in its crypto fallback that Turbopack can't
  // bundle into a Server Component/Route Handler chunk -- opt it (and its
  // wrapper) out of bundling so they're resolved with native `require`
  // instead, same as Next's own built-in list does for e.g. `sharp`/`pg`.
  serverExternalPackages: ["ssh2", "node-ssh"],
};

export default nextConfig;
