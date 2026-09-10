import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const OPERATIONS_SWEEP_QUEUE = "operations-sweep";

let queue: Queue | null = null;
function getQueue(): Queue {
  if (!queue) queue = new Queue(OPERATIONS_SWEEP_QUEUE, { connection: getRedisConnection() });
  return queue;
}

/** Schedules the daily sweep to run once every 24 hours, starting now. */
export async function scheduleOperationsSweep() {
  await getQueue().upsertJobScheduler(
    "daily-operations-sweep",
    { every: 24 * 60 * 60 * 1000 },
    { name: "sweep", opts: { removeOnComplete: 20, removeOnFail: 20 } }
  );
}
