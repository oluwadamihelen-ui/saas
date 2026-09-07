import { describe, it, expect, vi } from "vitest";

/**
 * Regression test for a real bug found in production use: getRedisConnection
 * is configured with maxRetriesPerRequest: null (so BullMQ's workers queue
 * and keep retrying instead of dropping jobs when Redis is briefly down),
 * which means a plain `await redis.incr(...)` hangs forever -- it never
 * rejects -- when Redis is unreachable. Login (and checkout, and the public
 * API routes) call checkRateLimit before doing anything else, so an
 * unreachable Redis instance silently blocked every login attempt, with no
 * error surfaced anywhere except ioredis's own "Unhandled error event" spam.
 * checkRateLimit must fail OPEN (allow the request) within a bounded time
 * whenever Redis is unavailable, never hang and never block the caller.
 */
vi.mock("@/lib/queue/connection", () => ({
  getRedisConnection: () => ({
    incr: () => new Promise(() => {}), // never resolves, mirroring the real hang
    expire: () => new Promise(() => {}),
    ttl: () => new Promise(() => {}),
  }),
}));

describe("checkRateLimit: fails open when Redis is unreachable", () => {
  it("resolves allowed:true within a bounded time instead of hanging forever", async () => {
    const { checkRateLimit } = await import("@/lib/security/rate-limit");

    const start = Date.now();
    const result = await checkRateLimit("fail-open-test", 5, 60);
    const elapsedMs = Date.now() - start;

    expect(result.allowed).toBe(true);
    expect(elapsedMs).toBeLessThan(2000);
  }, 5000);

  it("enforceRateLimit does not throw when Redis is unreachable", async () => {
    const { enforceRateLimit } = await import("@/lib/security/rate-limit");
    await expect(enforceRateLimit("fail-open-test-2", 5, 60)).resolves.toBeUndefined();
  }, 5000);
});
