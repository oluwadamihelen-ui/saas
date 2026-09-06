import { Job, Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { DEPLOYMENT_QUEUE_NAME, RunDeploymentPipelineJob } from "./deploymentQueue";
import { prisma } from "@/lib/db";
import { deploymentAdapterRegistry } from "@/lib/providers/deployment/registry";
import { DeploymentConnectionTarget } from "@/lib/providers/deployment/types";
import { DeploymentStatus } from "@/generated/prisma/client";
import { logger } from "@/lib/security/logger";
import { notifyUser } from "@/lib/services/notifications";
import { recordAuditLog } from "@/lib/security/audit";

/** A configuration error is never retried -- it needs the customer (or admin) to fix something. Anything else is treated as transient and left to BullMQ's retry/backoff. */
export class DeploymentConfigurationError extends Error {}

const TRANSIENT_ERROR_PATTERNS = [/timeout/i, /econnreset/i, /rate.?limit/i, /temporarily unavailable/i, /econnrefused/i, /503/];

export function isTransientError(error: unknown): boolean {
  if (error instanceof DeploymentConfigurationError) return false;
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function log(deploymentId: string, jobId: string, message: string, level: "INFO" | "WARN" | "ERROR" = "INFO") {
  await prisma.deploymentLog.create({
    data: { deploymentId, jobId, level, message, isCustomerVisible: true },
  });
}

async function setStatus(deploymentId: string, status: DeploymentStatus) {
  await prisma.deployment.update({ where: { id: deploymentId }, data: { status } });
}

function buildPublicEnvVars(schema: unknown): Record<string, string> {
  if (!Array.isArray(schema)) return {};
  const out: Record<string, string> = {};
  for (const entry of schema as { key?: string; secret?: boolean; defaultValue?: string }[]) {
    if (entry?.key && !entry.secret && entry.defaultValue) out[entry.key] = entry.defaultValue;
  }
  return out;
}

/**
 * Runs the full provisioning pipeline for one deployment. Every step is
 * driven by the DeploymentProviderAdapter interface resolved from the
 * DeploymentTarget's adapter key (SSH, cPanel, Docker, or -- in dev, and for
 * any adapter not yet implemented -- the mock), so the pipeline itself never
 * changes when a real adapter is added. Never interpolates raw customer
 * input into a shell command -- everything here comes from validated
 * ApplicationVersion/DeploymentSpecification configuration.
 */
export async function processDeploymentPipeline(bullJob: Job<RunDeploymentPipelineJob>) {
  const { deploymentId, deploymentJobId } = { deploymentId: bullJob.data.deploymentId, deploymentJobId: bullJob.data.deploymentJobId };

  const deployment = await prisma.deployment.findUniqueOrThrow({
    where: { id: deploymentId },
    include: {
      application: true,
      applicationVersion: { include: { deploymentSpecification: true } },
      domain: true,
      deploymentTarget: true,
    },
  });

  const spec = deployment.applicationVersion.deploymentSpecification;
  if (!spec) {
    await log(deploymentId, deploymentJobId, "Deployment failed: application version has no deployment specification configured.", "ERROR");
    await setStatus(deploymentId, "FAILED");
    await prisma.deploymentJob.update({ where: { id: deploymentJobId }, data: { status: "FAILED", finishedAt: new Date(), error: "Missing deployment specification" } });
    return; // configuration error, never retried
  }

  await prisma.deploymentJob.update({ where: { id: deploymentJobId }, data: { status: "RUNNING", startedAt: new Date() } });
  await recordAuditLog({ actorId: deployment.customerId, action: "deployment.started", resourceType: "Deployment", resourceId: deploymentId });

  const adapterKey = deployment.deploymentTarget?.provider ?? "mock";
  const provider = deploymentAdapterRegistry.resolve(adapterKey);
  const target: DeploymentConnectionTarget = {
    deploymentId,
    deploymentTargetId: deployment.deploymentTargetId ?? undefined,
    adapter: adapterKey as DeploymentConnectionTarget["adapter"],
    host: deployment.deploymentTarget?.hostname ?? undefined,
    port: deployment.deploymentTarget?.port ?? undefined,
  };

  const stepInput = {
    target,
    applicationSlug: deployment.application.slug,
    version: deployment.applicationVersion.version,
    runtime: spec.runtime,
    buildCommand: spec.buildCommand,
    startCommand: spec.startCommand,
    installCommand: spec.installCommand,
    migrationCommand: spec.migrationCommand,
    envVars: buildPublicEnvVars(spec.environmentVariables),
  };

  try {
    await log(deploymentId, deploymentJobId, "Validating deployment target.");
    const validation = await provider.validateTarget(target);
    if (!validation.valid) {
      if (validation.isConfigurationError) {
        await log(deploymentId, deploymentJobId, `Needs your attention: ${validation.message}`, "WARN");
        await setStatus(deploymentId, "NEEDS_CUSTOMER_ACTION");
        await prisma.deploymentJob.update({ where: { id: deploymentJobId }, data: { status: "FAILED", finishedAt: new Date(), error: validation.message } });
        await notifyUser(deployment.customerId, {
          type: "deployment.needs_action",
          title: "Deployment needs your input",
          message: `${deployment.application.name}: ${validation.message}`,
          data: { deploymentId },
        });
        return; // configuration error -- do not retry
      }
      throw new Error(validation.message);
    }

    await setStatus(deploymentId, "PREPARING");
    await log(deploymentId, deploymentJobId, "Preparing application package.");
    await provider.prepareEnvironment(stepInput);

    await setStatus(deploymentId, "CONNECTING");
    await log(deploymentId, deploymentJobId, `Connecting to target via ${target.adapter} adapter.`);
    const connectResult = await provider.connect(target);
    await log(deploymentId, deploymentJobId, connectResult.message);

    await setStatus(deploymentId, "INSTALLING");
    await log(deploymentId, deploymentJobId, "Installing application.");
    const installResult = await provider.deploy(stepInput);
    await log(deploymentId, deploymentJobId, installResult.message);

    await setStatus(deploymentId, "CONFIGURING");
    const configResult = await provider.configureEnvironment(stepInput);
    await log(deploymentId, deploymentJobId, configResult.message);

    if (spec.databaseType) {
      await setStatus(deploymentId, "DATABASE_SETUP");
      await log(deploymentId, deploymentJobId, `Provisioning ${spec.databaseType} database.`);

      if (spec.migrationCommand) {
        await setStatus(deploymentId, "MIGRATING");
        const migrationResult = await provider.runMigrations(stepInput);
        await log(deploymentId, deploymentJobId, migrationResult.message);
      }
    }

    if (deployment.domain) {
      await setStatus(deploymentId, "DNS_SETUP");
      const dnsResult = await provider.configureDomain(target, deployment.domain.name);
      await log(deploymentId, deploymentJobId, dnsResult.message);

      await setStatus(deploymentId, "SSL_SETUP");
      const sslResult = await provider.configureSSL(target, deployment.domain.name);
      await log(deploymentId, deploymentJobId, sslResult.message);
    }

    await setStatus(deploymentId, "HEALTH_CHECK");
    const healthUrl = deployment.domain ? `https://${deployment.domain.name}` : (deployment.previewUrl ?? "https://staging.internal");
    const health = await provider.runHealthCheck(target, healthUrl);
    await log(
      deploymentId,
      deploymentJobId,
      `Health check: HTTP ${health.httpOk ? "OK" : "FAILED"}, SSL ${health.sslValid ? "valid" : "invalid"}.`
    );

    // Only COMPLETED when the health check actually passes -- a deployment
    // that installed but fails its health check is not "done", it's FAILED.
    if (!health.applicationHealthy) {
      await log(deploymentId, deploymentJobId, "Deployment failed: application did not pass its health check.", "ERROR");
      await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "FAILED", healthStatus: "OFFLINE", lastHealthCheckAt: new Date() } });
      await prisma.deploymentJob.update({ where: { id: deploymentJobId }, data: { status: "FAILED", finishedAt: new Date(), error: "Health check failed", result: health as never } });
      await recordAuditLog({ actorId: deployment.customerId, action: "deployment.failed", resourceType: "Deployment", resourceId: deploymentId, newValue: { reason: "health_check_failed" } });
      await notifyUser(deployment.customerId, {
        type: "deployment.failed",
        title: "Deployment issue",
        message: `We ran into an issue deploying ${deployment.application.name}. Our operations team has been notified.`,
        data: { deploymentId },
      });
      return;
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: "COMPLETED", healthStatus: "HEALTHY", lastHealthCheckAt: new Date() },
    });
    await log(deploymentId, deploymentJobId, "Deployment completed successfully.");

    await prisma.deploymentJob.update({
      where: { id: deploymentJobId },
      data: { status: "SUCCEEDED", finishedAt: new Date(), result: health as never },
    });

    await recordAuditLog({ actorId: deployment.customerId, action: "deployment.completed", resourceType: "Deployment", resourceId: deploymentId });
    await notifyUser(deployment.customerId, {
      type: "deployment.completed",
      title: "Your application is live",
      message: `${deployment.application.name} has finished deploying and is ready to use.`,
      data: { deploymentId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown deployment error";
    const transient = isTransientError(error);
    logger.error("deployment.pipeline_failed", { deploymentId, error: message, transient });
    await log(deploymentId, deploymentJobId, `Deployment failed: ${message}`, "ERROR");

    if (transient) {
      // Leave Deployment.status where it was (customer sees the in-progress
      // step); mark the job attempt failed and let BullMQ retry it.
      await prisma.deploymentJob.update({
        where: { id: deploymentJobId },
        data: { status: "RETRYING", error: message, attempts: { increment: 1 } },
      });
      throw error; // BullMQ retries per the job's attempts/backoff policy
    }

    // Permanent/configuration failure: stop here, do not retry.
    await setStatus(deploymentId, "FAILED");
    await prisma.deploymentJob.update({
      where: { id: deploymentJobId },
      data: { status: "FAILED", finishedAt: new Date(), error: message, attempts: { increment: 1 } },
    });
    await recordAuditLog({ actorId: deployment.customerId, action: "deployment.failed", resourceType: "Deployment", resourceId: deploymentId, newValue: { reason: message } });
    await notifyUser(deployment.customerId, {
      type: "deployment.failed",
      title: "Deployment issue",
      message: `We ran into an issue deploying ${deployment.application.name}. Our operations team has been notified.`,
      data: { deploymentId },
    });
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
