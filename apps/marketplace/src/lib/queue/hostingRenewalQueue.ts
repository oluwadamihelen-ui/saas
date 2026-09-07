import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const HOSTING_RENEWAL_QUEUE_NAME = "hosting-renewals";
const SCHEDULER_ID = "hosting-renewal-sweep";

let queue: Queue | null = null;

export function getHostingRenewalQueue(): Queue {
  if (!queue) {
    queue = new Queue(HOSTING_RENEWAL_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}

/**
 * Schedules the daily hosting billing sweep as a BullMQ job scheduler.
 * Idempotent: upsertJobScheduler replaces any existing scheduler with this
 * ID rather than adding a duplicate, so calling this on every worker boot
 * is safe.
 */
export async function scheduleHostingRenewalSweep() {
  const q = getHostingRenewalQueue();
  await q.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: "15 6 * * *" }, // daily at 06:15 server time, offset from the domain sweep
    { name: "sweep", opts: { removeOnComplete: 20, removeOnFail: 20 } }
  );
}
