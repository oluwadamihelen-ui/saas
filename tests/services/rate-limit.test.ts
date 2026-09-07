import { describe, it, expect, afterAll } from "vitest";
import { checkRateLimit, enforceRateLimit, RateLimitExceededError } from "@/lib/security/rate-limit";
import { getRedisConnection } from "@/lib/queue/connection";

const SUFFIX = `ratelimit-${Date.now()}`;
const keys: string[] = [];

function trackedKey(label: string) {
  const key = `${SUFFIX}-${label}`;
  keys.push(key);
  return key;
}

describe("checkRateLimit", () => {
  afterAll(async () => {
    const redis = getRedisConnection();
    await Promise.all(keys.map((k) => redis.del(`ratelimit:${k}`)));
  });

  it("allows requests up to the limit and blocks the next one", async () => {
    const key = trackedKey("basic");
    for (let i = 1; i <= 3; i++) {
      const result = await checkRateLimit(key, 3, 60);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(i);
      expect(result.limit).toBe(3);
    }

    const blocked = await checkRateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(4);
  });

  it("tracks separate keys independently", async () => {
    const keyA = trackedKey("a");
    const keyB = trackedKey("b");

    await checkRateLimit(keyA, 1, 60);
    const resultA = await checkRateLimit(keyA, 1, 60);
    const resultB = await checkRateLimit(keyB, 1, 60);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("sets a resetAt in the future on the first hit", async () => {
    const key = trackedKey("resetat");
    const result = await checkRateLimit(key, 5, 60);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("enforceRateLimit throws RateLimitExceededError once exceeded", async () => {
    const key = trackedKey("enforce");
    await enforceRateLimit(key, 1, 60);
    await expect(enforceRateLimit(key, 1, 60)).rejects.toThrow(RateLimitExceededError);
  });
});
