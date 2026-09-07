import IORedis from "ioredis";
import { logger } from "@/lib/security/logger";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
    // Without a listener, ioredis logs "Unhandled error event" on every
    // failed reconnect attempt (e.g. Redis not running locally) -- harmless
    // on its own, but noisy enough to look like a real failure, and an
    // EventEmitter's convention is that an unlistened 'error' event is
    // supposed to be fatal. Route it through the app's own logger instead.
    connection.on("error", (err) => {
      logger.warn("redis.connection_error", { error: err instanceof Error ? err.message : "unknown error" });
    });
  }
  return connection;
}
