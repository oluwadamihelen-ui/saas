import { createRedisClient, type Redis } from "@cinerra/queue";
import { env } from "./env";

const globalForRateLimit = globalThis as unknown as { rateLimitRedis?: Redis };

// Constructed lazily on first actual rate-limit check, not at module load —
// this file is imported from auth.ts, which nearly every page pulls in via
// Header's auth() call, so an eager connection here would mean Next.js
// attempting a real Redis connection during static page generation at
// build time (a login/signup attempt just never happens then).
function getRedis(): Redis {
  if (!globalForRateLimit.rateLimitRedis) {
    globalForRateLimit.rateLimitRedis = createRedisClient(env.REDIS_URL);
  }
  return globalForRateLimit.rateLimitRedis;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter backed by Redis — shared across every server
 * instance, unlike an in-memory counter, which is what a Next.js
 * deployment with more than one process/instance actually needs. INCR +
 * EXPIRE has a small, well-understood race at the very first request in a
 * window (two concurrent requests could both see count===1 and each set
 * the TTL), which is acceptable for abuse-prevention — this is not a
 * billing-grade metering primitive.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redis = getRedis();
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }
  const ttl = await redis.ttl(redisKey);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

/** Best-effort client IP from standard proxy headers — "unknown" shares one bucket across unidentified clients rather than throwing. */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** Account-creation abuse: both the JSON API and the signup page's server action share this policy, keyed by IP. */
export async function checkSignupRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`signup:${ip}`, 5, 60 * 60);
}

/**
 * Credential-stuffing/brute-force protection, keyed by the *email being
 * attempted* rather than IP — the real attack (guessing one account's
 * password) is often distributed across many IPs, which a per-IP limit
 * alone wouldn't catch. Counts every attempt, successful or not, which is
 * simpler than tracking failures only and still gives a legitimate user
 * typing their password wrong a few times plenty of room.
 */
export async function checkLoginRateLimit(email: string): Promise<RateLimitResult> {
  return checkRateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60);
}
