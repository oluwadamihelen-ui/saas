import { prisma } from "@/lib/db";
import { DeploymentType } from "@/generated/prisma/client";
import { enqueueDeploymentPipeline } from "@/lib/queue/deploymentQueue";
import { getLatestVersion } from "@/lib/services/application-versions";
import { getOrCreateMockTarget } from "@/lib/services/deployment-targets";
import { recordAuditLog } from "@/lib/security/audit";
import { logger } from "@/lib/security/logger";

export interface CreateDeploymentInput {
  customerId: string;
  orderId?: string;
  applicationId: string;
  /** Defaults to the application's latest published version. */
  applicationVersionId?: string;
  type: DeploymentType;
  domainId?: string;
  hostingAccountId?: string;
  deploymentTargetId?: string;
  previousDeploymentId?: string;
}

// Customer-facing simplified timeline; admins additionally see DATABASE_SETUP/MIGRATING.
export const DEPLOYMENT_TIMELINE_STEPS = [
  "QUEUED",
  "PREPARING",
  "CONNECTING",
  "INSTALLING",
  "CONFIGURING",
  "DNS_SETUP",
  "SSL_SETUP",
  "HEALTH_CHECK",
  "COMPLETED",
] as const;

export async function createDeployment(input: CreateDeploymentInput) {
  const application = await prisma.application.findUniqueOrThrow({ where: { id: input.applicationId } });

  const version = input.applicationVersionId
    ? await prisma.applicationVersion.findUniqueOrThrow({ where: { id: input.applicationVersionId } })
    : await getLatestVersion(input.applicationId);
  if (!version) {
    throw new Error(`Application ${application.slug} has no published version configured`);
  }

  // A deployment always has somewhere to run: an explicit target, or (for
  // managed/mock flows where none was set up yet) a lazily-created mock
  // target so the pipeline still has a concrete adapter to resolve.
  const deploymentTargetId = input.deploymentTargetId ?? (await getOrCreateMockTarget(input.customerId)).id;

  const previewUrl = input.domainId ? null : `https://${application.slug}-${Math.random().toString(36).slice(2, 8)}.preview.bridgecodes.app`;

  const deployment = await prisma.deployment.create({
    data: {
      customerId: input.customerId,
      orderId: input.orderId,
      applicationId: application.id,
      applicationVersionId: version.id,
      type: input.type,
      status: "QUEUED",
      domainId: input.domainId,
      hostingAccountId: input.hostingAccountId,
      deploymentTargetId,
      previousDeploymentId: input.previousDeploymentId,
      previewUrl,
      logs: {
        create: { level: "INFO", message: "Order received. Deployment queued.", isCustomerVisible: true },
      },
    },
  });

  const job = await prisma.deploymentJob.create({
    data: {
      deploymentId: deployment.id,
      jobType: "run_pipeline",
      status: "QUEUED",
      payload: { deploymentId: deployment.id },
    },
  });

  await enqueueDeploymentPipeline({ deploymentJobId: job.id, deploymentId: deployment.id });
  await recordAuditLog({
    actorId: input.customerId,
    action: "deployment.created",
    resourceType: "Deployment",
    resourceId: deployment.id,
    newValue: { applicationId: application.id, version: version.version, type: input.type },
  });
  logger.info("deployment.queued", { deploymentId: deployment.id, jobId: job.id });

  return deployment;
}

/**
 * Customer-initiated version upgrade: queues a fresh deployment of a
 * different already-published (isStable) version of the same application
 * against the same target, and marks this one superseded. Mirrors the
 * admin rollbackDeployment action exactly, just choosing the target version
 * by customer selection instead of the version's configured rollbackOf.
 */
export async function upgradeDeployment(customerId: string, deploymentId: string, targetVersionId: string) {
  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, customerId },
    include: { applicationVersion: true },
  });
  if (!deployment) throw new Error("Deployment not found.");
  if (deployment.status !== "COMPLETED") {
    throw new Error("Only a live deployment can be upgraded.");
  }

  const targetVersion = await prisma.applicationVersion.findFirst({
    where: { id: targetVersionId, applicationId: deployment.applicationId, isStable: true },
  });
  if (!targetVersion) {
    throw new Error("That version is not available to upgrade to.");
  }
  if (targetVersion.id === deployment.applicationVersionId) {
    throw new Error("This deployment is already running that version.");
  }

  // Same active-license check as requesting a brand new deployment -- an
  // upgrade is still granting a deploy, not just a version bump.
  const license = await prisma.applicationLicense.findFirst({
    where: { applicationId: deployment.applicationId, customerId, status: "ACTIVE" },
  });
  if (!license) {
    throw new Error("You don't have an active license for this application.");
  }

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "UPGRADING" } });

  const upgraded = await createDeployment({
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

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "UPGRADED" } });

  await recordAuditLog({
    actorId: customerId,
    action: "deployment.upgraded",
    resourceType: "Deployment",
    resourceId: deploymentId,
    oldValue: { version: deployment.applicationVersion.version },
    newValue: { version: targetVersion.version, newDeploymentId: upgraded.id },
  });

  return upgraded;
}

export async function getDeploymentForCustomer(deploymentId: string, customerId: string) {
  return prisma.deployment.findFirst({
    where: { id: deploymentId, customerId },
    include: {
      application: true,
      applicationVersion: { include: { deploymentSpecification: true } },
      domain: true,
      hostingAccount: true,
      deploymentTarget: true,
      logs: { where: { isCustomerVisible: true }, orderBy: { createdAt: "asc" } },
      jobs: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function listDeploymentsForCustomer(customerId: string) {
  return prisma.deployment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { application: true, domain: true, deploymentTarget: true },
  });
}
