import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { DOMAIN_RENEWAL_QUEUE_NAME } from "./domainRenewalQueue";
import { runDomainRenewalSweep } from "@/lib/services/domain-renewal-scheduler";
import { logger } from "@/lib/security/logger";

export function startDomainRenewalWorker() {
  const worker = new Worker(
    DOMAIN_RENEWAL_QUEUE_NAME,
    async () => {
      const result = await runDomainRenewalSweep();
      logger.info("domain_renewal.sweep_completed", { ...result });
      return result;
    },
    { connection: getRedisConnection() }
  );

  worker.on("completed", (job) => logger.info("domain_renewal.job_completed", { jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("domain_renewal.job_failed", { jobId: job?.id, error: err.message }));

  return worker;
}
