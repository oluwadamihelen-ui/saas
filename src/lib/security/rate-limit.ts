import { NextRequest } from "next/server";
import { getRedisConnection } from "@/lib/queue/connection";

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

/**
 * Fixed-window request limiter backed by the same Redis instance BullMQ
 * already uses -- no extra infrastructure. INCR is atomic, so concurrent
 * requests racing for the same key still count correctly; the window resets
 * (via EXPIRE, set only on the first hit) rather than sliding, which is a
 * simpler guarantee than a sliding window and plenty for abuse prevention
 * here (login attempts, public API calls) rather than precise API quotas.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redis = getRedisConnection();
  const redisKey = `ratelimit:${key}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  const ttl = await redis.ttl(redisKey);
  const resetAt = new Date(Date.now() + Math.max(ttl, 0) * 1000);

  return { allowed: count <= limit, count, limit, resetAt };
}

/** Throws RateLimitExceededError instead of returning a result -- for call sites (server actions, authorize callbacks) that just want to bail out. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const result = await checkRateLimit(key, limit, windowSeconds);
  if (!result.allowed) throw new RateLimitExceededError(result.resetAt);
}
