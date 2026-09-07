import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { HOSTING_RENEWAL_QUEUE_NAME } from "./hostingRenewalQueue";
import { runHostingRenewalSweep } from "@/lib/services/hosting-renewal-scheduler";
import { logger } from "@/lib/security/logger";

export function startHostingRenewalWorker() {
  const worker = new Worker(
    HOSTING_RENEWAL_QUEUE_NAME,
    async () => {
      const result = await runHostingRenewalSweep();
      logger.info("hosting_renewal.sweep_completed", { ...result });
      return result;
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) => logger.info("hosting_renewal.job_completed", { jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("hosting_renewal.job_failed", { jobId: job?.id, error: err.message }));

  return worker;
}
