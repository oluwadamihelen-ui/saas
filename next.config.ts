import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated to a non-default path (src/generated/prisma
  // instead of node_modules/.prisma/client), so Next.js's serverless file
  // tracer doesn't automatically detect that the query engine binaries
  // (*.so.node) are needed at runtime and drops them from the deployed
  // function -- causing PrismaClientInitializationError in production even
  // though `prisma generate` ran fine at build time.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
