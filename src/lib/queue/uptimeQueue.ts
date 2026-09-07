import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const UPTIME_QUEUE_NAME = "uptime-checks";
const SCHEDULER_ID = "uptime-sweep";

let queue: Queue | null = null;

export function getUptimeQueue(): Queue {
  if (!queue) {
    queue = new Queue(UPTIME_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}

/**
 * Schedules the recurring uptime re-check sweep as a BullMQ job scheduler.
 * Idempotent: upsertJobScheduler replaces any existing scheduler with this
 * ID rather than adding a duplicate, so calling this on every worker boot
 * is safe. Every 15 minutes -- frequent enough to catch an outage well
 * before a daily sweep would, without hammering every deployment's target.
 */
export async function scheduleUptimeSweep() {
  const q = getUptimeQueue();
  await q.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: "*/15 * * * *" },
    { name: "sweep", opts: { removeOnComplete: 20, removeOnFail: 20 } }
  );
}
