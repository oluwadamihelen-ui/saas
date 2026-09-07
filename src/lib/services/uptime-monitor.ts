import { prisma } from "@/lib/db";
import { deploymentAdapterRegistry } from "@/lib/providers/deployment/registry";
import { DeploymentConnectionTarget } from "@/lib/providers/deployment/types";
import { notifyUser } from "@/lib/services/notifications";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

export interface UptimeSweepResult {
  checked: number;
  healthy: number;
  degraded: number;
  offline: number;
  newlyOffline: number;
  recovered: number;
}

/**
 * Runs on a schedule (see uptimeWorker.ts) to keep Deployment.healthStatus
 * current after the one-time post-deploy check that processDeploymentPipeline
 * runs -- otherwise a deployment that goes down after completing never shows
 * it. Re-checks every COMPLETED deployment through the same
 * DeploymentProviderAdapter.runHealthCheck used at deploy time, so this
 * behaves identically to a real re-check regardless of which adapter is
 * configured. Only notifies on a HEALTHY/UNKNOWN -> OFFLINE or
 * OFFLINE -> HEALTHY transition, not on every sweep, so a customer isn't
 * paged every 15 minutes for a deployment that's been down since the last
 * check.
 */
export async function runUptimeSweep(now: Date = new Date()): Promise<UptimeSweepResult> {
  const result: UptimeSweepResult = { checked: 0, healthy: 0, degraded: 0, offline: 0, newlyOffline: 0, recovered: 0 };

  const deployments = await prisma.deployment.findMany({
    where: { status: "COMPLETED" },
    include: { application: true, domain: true, deploymentTarget: true },
  });
  result.checked = deployments.length;

  for (const deployment of deployments) {
    const adapterKey = deployment.deploymentTarget?.provider ?? "mock";
    const provider = deploymentAdapterRegistry.resolve(adapterKey);
    const target: DeploymentConnectionTarget = {
      deploymentId: deployment.id,
      deploymentTargetId: deployment.deploymentTargetId ?? undefined,
      adapter: adapterKey as DeploymentConnectionTarget["adapter"],
      host: deployment.deploymentTarget?.hostname ?? undefined,
      port: deployment.deploymentTarget?.port ?? undefined,
      username: deployment.deploymentTarget?.sshUsername ?? undefined,
    };
    const healthUrl = deployment.domain ? `https://${deployment.domain.name}` : (deployment.previewUrl ?? "https://staging.internal");

    let health;
    try {
      health = await provider.runHealthCheck(target, healthUrl);
    } catch (error) {
      logger.error("uptime.check_failed", { deploymentId: deployment.id, error: error instanceof Error ? error.message : "unknown error" });
      continue;
    }

    const previousStatus = deployment.healthStatus;
    const newStatus = health.applicationHealthy ? "HEALTHY" : health.httpOk ? "WARNING" : "OFFLINE";

    await prisma.deployment.update({ where: { id: deployment.id }, data: { healthStatus: newStatus, lastHealthCheckAt: now } });

    if (newStatus === "HEALTHY") result.healthy++;
    else if (newStatus === "WARNING") result.degraded++;
    else result.offline++;

    if (previousStatus !== "OFFLINE" && newStatus === "OFFLINE") {
      result.newlyOffline++;
      await recordAuditLog({
        actorId: deployment.customerId,
        action: "deployment.went_offline",
        resourceType: "Deployment",
        resourceId: deployment.id,
        oldValue: { healthStatus: previousStatus },
        newValue: { healthStatus: newStatus },
      });
      await notifyUser(deployment.customerId, {
        type: "deployment.went_offline",
        title: "Your deployment is offline",
        message: `${deployment.application.name} failed its latest health check. We're continuing to monitor it.`,
        data: { deploymentId: deployment.id },
      });
    } else if (previousStatus === "OFFLINE" && newStatus === "HEALTHY") {
      result.recovered++;
      await recordAuditLog({
        actorId: deployment.customerId,
        action: "deployment.recovered",
        resourceType: "Deployment",
        resourceId: deployment.id,
        oldValue: { healthStatus: previousStatus },
        newValue: { healthStatus: newStatus },
      });
      await notifyUser(deployment.customerId, {
        type: "deployment.recovered",
        title: "Your deployment is back online",
        message: `${deployment.application.name} passed its latest health check and is healthy again.`,
        data: { deploymentId: deployment.id },
      });
    }
  }

  return result;
}
