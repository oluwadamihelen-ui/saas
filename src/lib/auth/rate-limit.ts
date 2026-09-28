import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/security/logger";

const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 10 * 60;
// The shared connection is configured with maxRetriesPerRequest: null for
// BullMQ's sake (a background worker should retry forever), which means a
// command can hang indefinitely while Redis is unreachable rather than
// reject quickly. That's fine for a queue; it would turn a Redis outage
// into a hung, unusable login page. A hard timeout keeps this check
// bounded no matter what state the connection is in.
const REDIS_TIMEOUT_MS = 500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("redis operation timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Simple per-email login throttle backed by Redis (the same instance the
 * background queues use). Fails OPEN on any error or timeout -- an infra
 * hiccup must never lock every front desk out of the app, so a rate-limit
 * check we can't complete quickly is treated as "not limited" rather than
 * blocking login.
 */
export async function isLoginRateLimited(email: string): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const key = `login-attempts:${email}`;
    const count = await withTimeout(redis.incr(key), REDIS_TIMEOUT_MS);
    if (count === 1) await withTimeout(redis.expire(key, WINDOW_SECONDS), REDIS_TIMEOUT_MS);
    return count > MAX_ATTEMPTS;
  } catch (error) {
    logger.warn("auth.rate_limit_check_failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function resetLoginRateLimit(email: string): Promise<void> {
  try {
    await withTimeout(getRedisConnection().del(`login-attempts:${email}`), REDIS_TIMEOUT_MS);
  } catch {
    // best-effort only -- a stale counter just means one fewer attempt
    // available before the window resets naturally.
  }
}
