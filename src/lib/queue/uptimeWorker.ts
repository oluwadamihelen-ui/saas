import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { UPTIME_QUEUE_NAME } from "./uptimeQueue";
import { runUptimeSweep } from "@/lib/services/uptime-monitor";
import { logger } from "@/lib/security/logger";

export function startUptimeWorker() {
  const worker = new Worker(
    UPTIME_QUEUE_NAME,
    async () => {
      const result = await runUptimeSweep();
      logger.info("uptime.sweep_completed", { ...result });
      return result;
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) => logger.info("uptime.job_completed", { jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("uptime.job_failed", { jobId: job?.id, error: err.message }));

  return worker;
}
