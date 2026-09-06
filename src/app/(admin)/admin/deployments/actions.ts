"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enqueueDeploymentPipeline } from "@/lib/queue/deploymentQueue";
import { recordAuditLog } from "@/lib/security/audit";

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
