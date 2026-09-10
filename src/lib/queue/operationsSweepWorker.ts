import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { OPERATIONS_SWEEP_QUEUE } from "./operationsSweepQueue";
import { runDailyOperationsSweep } from "@/lib/services/operations-sweep";
import { logger } from "@/lib/security/logger";

export function startOperationsSweepWorker() {
  return new Worker(
    OPERATIONS_SWEEP_QUEUE,
    async () => {
      try {
        return await runDailyOperationsSweep();
      } catch (error) {
        logger.error("operations_sweep.failed", { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
    { connection: getRedisConnection() }
  );
}
