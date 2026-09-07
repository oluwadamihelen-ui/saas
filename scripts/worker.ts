import "dotenv/config";
import { startDeploymentWorker } from "@/lib/queue/deploymentWorker";
import { startDomainRenewalWorker } from "@/lib/queue/domainRenewalWorker";
import { scheduleDomainRenewalSweep } from "@/lib/queue/domainRenewalQueue";
import { startHostingRenewalWorker } from "@/lib/queue/hostingRenewalWorker";
import { scheduleHostingRenewalSweep } from "@/lib/queue/hostingRenewalQueue";
import { startUptimeWorker } from "@/lib/queue/uptimeWorker";
import { scheduleUptimeSweep } from "@/lib/queue/uptimeQueue";
import { logger } from "@/lib/security/logger";

const deploymentWorker = startDeploymentWorker();
logger.info("worker.deployment_started");

const domainRenewalWorker = startDomainRenewalWorker();
scheduleDomainRenewalSweep()
  .then(() => logger.info("worker.domain_renewal_started"))
  .catch((error) => logger.error("worker.domain_renewal_schedule_failed", { error: error instanceof Error ? error.message : String(error) }));

const hostingRenewalWorker = startHostingRenewalWorker();
scheduleHostingRenewalSweep()
  .then(() => logger.info("worker.hosting_renewal_started"))
  .catch((error) => logger.error("worker.hosting_renewal_schedule_failed", { error: error instanceof Error ? error.message : String(error) }));

const uptimeWorker = startUptimeWorker();
scheduleUptimeSweep()
  .then(() => logger.info("worker.uptime_sweep_started"))
  .catch((error) => logger.error("worker.uptime_sweep_schedule_failed", { error: error instanceof Error ? error.message : String(error) }));

// A process manager (systemd, PM2, Docker) restarts this process on exit, so
// the only failure mode worth guarding against here is silent death: an
// uncaught error in a spot BullMQ's own per-job error handling doesn't cover
// (e.g. inside a schedule callback above) would otherwise crash the process
// with no record of why. Logged, then exited non-zero so the process manager
// visibly restarts it rather than this becoming a silently-stuck container.
process.on("uncaughtException", (error) => {
  logger.error("worker.uncaught_exception", { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("worker.unhandled_rejection", { reason: reason instanceof Error ? reason.message : String(reason) });
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("worker.shutting_down", { signal });
  await Promise.all([deploymentWorker.close(), domainRenewalWorker.close(), hostingRenewalWorker.close(), uptimeWorker.close()]);
  logger.info("worker.shut_down", { signal });
  process.exit(0);
}

// SIGTERM is what systemd/PM2/Docker send on a normal stop or restart;
// SIGINT is Ctrl+C when running this directly in a terminal (e.g. `npm run
// worker` locally) -- both should drain in-flight jobs the same way rather
// than SIGINT just killing the process outright.
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
