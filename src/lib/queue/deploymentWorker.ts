import { Job, Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { DEPLOYMENT_QUEUE_NAME, RunDeploymentPipelineJob } from "./deploymentQueue";
import { prisma } from "@/lib/db";
import { getDeploymentProvider } from "@/lib/providers/registry";
import { DeploymentStatus } from "@/generated/prisma/client";
import { logger } from "@/lib/security/logger";
import { notifyUser } from "@/lib/services/notifications";

async function log(deploymentId: string, jobId: string, message: string, level: "INFO" | "WARN" | "ERROR" = "INFO") {
  await prisma.deploymentLog.create({
    data: { deploymentId, jobId, level, message, isCustomerVisible: true },
  });
}

async function setStatus(deploymentId: string, status: DeploymentStatus) {
  await prisma.deployment.update({ where: { id: deploymentId }, data: { status } });
}

/**
 * Runs the full provisioning pipeline for one deployment. Every step is
 * driven by the DeploymentProviderAdapter interface so the same pipeline
 * works whether the adapter is SSH, cPanel, Docker, or (in dev) the mock.
 * Never interpolates raw customer input into a shell command -- everything
 * here comes from validated Application/ApplicationVersion configuration.
 */
async function processDeploymentPipeline(bullJob: Job<RunDeploymentPipelineJob>) {
  const { deploymentId, deploymentJobId } = { deploymentId: bullJob.data.deploymentId, deploymentJobId: bullJob.data.deploymentJobId };

  const deployment = await prisma.deployment.findUniqueOrThrow({
    where: { id: deploymentId },
    include: { application: true, applicationVersion: true, domain: true },
  });

  await prisma.deploymentJob.update({ where: { id: deploymentJobId }, data: { status: "RUNNING", startedAt: new Date() } });

  const provider = await getDeploymentProvider();
  const target = {
    deploymentId,
    adapter: (deployment.adapter ?? "cloud") as "ssh" | "cpanel" | "plesk" | "docker" | "cloud",
  };

  try {
    await setStatus(deploymentId, "PREPARING");
    await log(deploymentId, deploymentJobId, "Preparing application package.");
    await provider.prepareEnvironment({
      target,
      applicationSlug: deployment.application.slug,
      version: deployment.applicationVersion.version,
      runtime: deployment.applicationVersion.runtime,
      buildCommand: deployment.applicationVersion.buildCommand,
      startCommand: deployment.applicationVersion.startCommand,
      envVars: {},
    });

    await setStatus(deploymentId, "CONNECTING");
    await log(deploymentId, deploymentJobId, `Connecting to target via ${target.adapter} adapter.`);
    const connectResult = await provider.connect(target);
    await log(deploymentId, deploymentJobId, connectResult.message);

    await setStatus(deploymentId, "INSTALLING");
    await log(deploymentId, deploymentJobId, "Installing application.");
    const installResult = await provider.installApplication({
      target,
      applicationSlug: deployment.application.slug,
      version: deployment.applicationVersion.version,
      runtime: deployment.applicationVersion.runtime,
      buildCommand: deployment.applicationVersion.buildCommand,
      startCommand: deployment.applicationVersion.startCommand,
      envVars: {},
    });
    await log(deploymentId, deploymentJobId, installResult.message);

    await setStatus(deploymentId, "CONFIGURING");
    await log(deploymentId, deploymentJobId, "Configuring application environment.");

    if (deployment.domain) {
      await setStatus(deploymentId, "DNS_SETUP");
      const dnsResult = await provider.configureDomain(target, deployment.domain.name);
      await log(deploymentId, deploymentJobId, dnsResult.message);

      await setStatus(deploymentId, "SSL_SETUP");
      const sslResult = await provider.issueSSL(target, deployment.domain.name);
      await log(deploymentId, deploymentJobId, sslResult.message);
    }

    await setStatus(deploymentId, "TESTING");
    const healthUrl = deployment.domain ? `https://${deployment.domain.name}` : "https://staging.internal";
    const health = await provider.runHealthCheck(target, healthUrl);
    await log(
      deploymentId,
      deploymentJobId,
      `Health check: HTTP ${health.httpOk ? "OK" : "FAILED"}, SSL ${health.sslValid ? "valid" : "invalid"}.`
    );

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "COMPLETED",
        healthStatus: health.applicationHealthy ? "HEALTHY" : "WARNING",
        lastHealthCheckAt: new Date(),
      },
    });
    await log(deploymentId, deploymentJobId, "Deployment completed successfully.");

    await prisma.deploymentJob.update({
      where: { id: deploymentJobId },
      data: { status: "SUCCEEDED", finishedAt: new Date(), result: health as never },
    });

    await notifyUser(deployment.customerId, {
      type: "deployment.completed",
      title: "Your application is live",
      message: `${deployment.application.name} has finished deploying and is ready to use.`,
      data: { deploymentId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deployment error";
    logger.error("deployment.pipeline_failed", { deploymentId, error: message });
    await log(deploymentId, deploymentJobId, `Deployment failed: ${message}`, "ERROR");
    await setStatus(deploymentId, "FAILED");
    await prisma.deploymentJob.update({
      where: { id: deploymentJobId },
      data: { status: "FAILED", finishedAt: new Date(), error: message, attempts: { increment: 1 } },
    });
    await notifyUser(deployment.customerId, {
      type: "deployment.failed",
      title: "Deployment issue",
      message: `We ran into an issue deploying ${deployment.application.name}. Our operations team has been notified.`,
      data: { deploymentId },
    });
    throw error; // let BullMQ retry according to the job's backoff policy
  }
}

export function startDeploymentWorker() {
  const worker = new Worker(DEPLOYMENT_QUEUE_NAME, processDeploymentPipeline, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on("completed", (job) => logger.info("worker.job_completed", { jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("worker.job_failed", { jobId: job?.id, error: err.message }));

  return worker;
}
