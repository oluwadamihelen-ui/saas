import { NextRequest } from "next/server";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/security/logger";

/**
 * Best-effort client IP from the standard forwarding header a reverse proxy
 * sets (x-forwarded-for's first entry is the original client). Next.js's
 * App Router doesn't expose a reliable `request.ip` itself -- that's the
 * platform/proxy's job -- so this is the same header every deployment
 * fronted by a real load balancer or CDN already sends. Falls back to a
 * single shared bucket if absent (local dev, or a proxy that strips it)
 * rather than throwing, since rate limiting is defense in depth, not the
 * only line of defense.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
}

export class RateLimitExceededError extends Error {
  constructor(public readonly resetAt: Date) {
    super("Too many attempts. Please try again shortly.");
    this.name = "RateLimitExceededError";
  }
}

const REDIS_TIMEOUT_MS = 750;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Redis call timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Fixed-window request limiter backed by the same Redis instance BullMQ
 * already uses -- no extra infrastructure. INCR is atomic, so concurrent
 * requests racing for the same key still count correctly; the window resets
 * (via EXPIRE, set only on the first hit) rather than sliding, which is a
 * simpler guarantee than a sliding window and plenty for abuse prevention
 * here (login attempts, public API calls) rather than precise API quotas.
 *
 * Fails OPEN, not closed: this is defense in depth, not the only line of
 * defense, and the shared Redis connection is configured with
 * maxRetriesPerRequest: null (so BullMQ's workers queue and keep retrying
 * indefinitely instead of dropping jobs) -- which means a plain `await`
 * here would hang forever, not throw, if Redis is unreachable. A rate
 * limiter that can take down login/checkout because its own backing store
 * is briefly down is worse than no rate limiter at all, so any error or
 * timeout here is logged and treated as "allow".
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const fallback: RateLimitResult = { allowed: true, count: 0, limit, resetAt: new Date(Date.now() + windowSeconds * 1000) };

  try {
    const redis = getRedisConnection();
    const count = await withTimeout(redis.incr(redisKey), REDIS_TIMEOUT_MS);
    if (count === 1) {
      await withTimeout(redis.expire(redisKey, windowSeconds), REDIS_TIMEOUT_MS);
    }
    const ttl = await withTimeout(redis.ttl(redisKey), REDIS_TIMEOUT_MS);
    const resetAt = new Date(Date.now() + Math.max(ttl, 0) * 1000);

    return { allowed: count <= limit, count, limit, resetAt };
  } catch (error) {
    logger.warn("rate_limit.redis_unavailable", { key, error: error instanceof Error ? error.message : "unknown error" });
    return fallback;
  }
}

/** Throws RateLimitExceededError instead of returning a result -- for call sites (server actions, authorize callbacks) that just want to bail out. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const result = await checkRateLimit(key, limit, windowSeconds);
  if (!result.allowed) throw new RateLimitExceededError(result.resetAt);
}
