import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const DOMAIN_RENEWAL_QUEUE_NAME = "domain-renewals";
const SCHEDULER_ID = "domain-renewal-sweep";

let queue: Queue | null = null;

export function getDomainRenewalQueue(): Queue {
  if (!queue) {
    queue = new Queue(DOMAIN_RENEWAL_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}

/**
 * Schedules the daily renewal sweep as a BullMQ job scheduler. Idempotent:
 * upsertJobScheduler replaces any existing scheduler with this ID rather
 * than adding a duplicate, so calling this on every worker boot is safe.
 */
export async function scheduleDomainRenewalSweep() {
  const q = getDomainRenewalQueue();
  await q.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: "0 6 * * *" }, // daily at 06:00 server time
    { name: "sweep", opts: { removeOnComplete: 20, removeOnFail: 20 } }
  );
}
