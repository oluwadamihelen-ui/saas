"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enqueueDeploymentPipeline } from "@/lib/queue/deploymentQueue";
import { recordAuditLog } from "@/lib/security/audit";
import { createDeployment } from "@/lib/services/deployments";

export async function retryDeployment(deploymentId: string) {
  const user = await requirePermission(PERMISSIONS.DEPLOYMENTS_MANAGE);

  await prisma.deployment.findUniqueOrThrow({ where: { id: deploymentId } });

  const job = await prisma.deploymentJob.create({
    data: { deploymentId, jobType: "run_pipeline", status: "QUEUED", payload: { deploymentId } },
  });

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "QUEUED" } });
  await prisma.deploymentLog.create({
    data: { deploymentId, level: "INFO", message: "Deployment manually retried by an administrator.", isCustomerVisible: true },
  });

  await enqueueDeploymentPipeline({ deploymentJobId: job.id, deploymentId });
  await recordAuditLog({ actorId: user.id, action: "deployment.retried", resourceType: "Deployment", resourceId: deploymentId });

  revalidatePath(`/admin/deployments/${deploymentId}`);
}

export async function cancelDeployment(deploymentId: string) {
  const user = await requirePermission(PERMISSIONS.DEPLOYMENTS_MANAGE);

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "CANCELLED" } });
  await prisma.deploymentLog.create({
    data: { deploymentId, level: "WARN", message: "Deployment cancelled by an administrator.", isCustomerVisible: true },
  });

  await recordAuditLog({ actorId: user.id, action: "deployment.cancelled", resourceType: "Deployment", resourceId: deploymentId });
  revalidatePath(`/admin/deployments/${deploymentId}`);
}

/**
 * Rolls back a deployment to the version its current version declares as
 * `rollbackOf`: queues a fresh deployment of that earlier version against
 * the same target, and marks this one superseded. The new deployment goes
 * through the normal async pipeline like any other -- rollback is not a
 * special synchronous path.
 */
export async function rollbackDeployment(deploymentId: string) {
  const user = await requirePermission(PERMISSIONS.DEPLOYMENTS_MANAGE);

  const deployment = await prisma.deployment.findUniqueOrThrow({
    where: { id: deploymentId },
    include: { applicationVersion: true },
  });

  const targetVersionString = deployment.applicationVersion.rollbackOf;
  if (!targetVersionString) {
    throw new Error("This version has no configured rollback target.");
  }

  const targetVersion = await prisma.applicationVersion.findFirst({
    where: { applicationId: deployment.applicationId, version: targetVersionString },
  });
  if (!targetVersion) {
    throw new Error(`Rollback target version ${targetVersionString} was not found.`);
  }

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "ROLLING_BACK" } });

  const rollbackDeployment = await createDeployment({
    customerId: deployment.customerId,
    orderId: deployment.orderId ?? undefined,
    applicationId: deployment.applicationId,
    applicationVersionId: targetVersion.id,
    type: deployment.type,
    domainId: deployment.domainId ?? undefined,
    hostingAccountId: deployment.hostingAccountId ?? undefined,
    deploymentTargetId: deployment.deploymentTargetId ?? undefined,
    previousDeploymentId: deployment.id,
  });

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "ROLLED_BACK" } });

  await recordAuditLog({
    actorId: user.id,
    action: "deployment.rolled_back",
    resourceType: "Deployment",
    resourceId: deploymentId,
    newValue: { rolledBackToVersion: targetVersionString, newDeploymentId: rollbackDeployment.id },
  });

  revalidatePath(`/admin/deployments/${deploymentId}`);
  revalidatePath(`/admin/deployments/${rollbackDeployment.id}`);
}
