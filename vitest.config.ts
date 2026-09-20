import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // These tests hit one real, shared Postgres database (no mocking layer
    // exists in this codebase — every service function calls Prisma
    // directly) and clean up their own fixtures via a shared slug prefix,
    // so test files must not run concurrently against it — one file's
    // afterAll would delete another file's still-in-progress fixtures.
    fileParallelism: false,
    // These tests hit a real Postgres database, so they need more headroom
    // than vitest's 5s default.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
