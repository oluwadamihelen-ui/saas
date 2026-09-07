"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/require";
import { createDeployment, upgradeDeployment as upgradeDeploymentService } from "@/lib/services/deployments";
import { deploymentTargetSchema } from "@/lib/services/deployment-targets";
import { encryptSecret } from "@/lib/security/encryption";

const requestDeploymentSchema = z.object({
  applicationId: z.string().uuid(),
  applicationVersionId: z.string().uuid(),
  deploymentType: z.enum(["CUSTOMER_SERVER", "PLATFORM_HOSTING", "MANAGED"]),
  hostingAccountId: z.string().uuid().optional().or(z.literal("")),
  hostname: z.string().trim().max(255).optional().or(z.literal("")),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  sshUsername: z.string().trim().max(80).optional().or(z.literal("")),
  operatingSystem: z.string().trim().max(80).optional().or(z.literal("")),
  controlPanel: z.string().trim().max(80).optional().or(z.literal("")),
  sshKey: z.string().trim().max(8000).optional().or(z.literal("")),
});

export interface RequestDeploymentState {
  status: "idle" | "error";
  message?: string;
}

export async function requestDeployment(_prev: RequestDeploymentState, formData: FormData): Promise<RequestDeploymentState> {
  const user = await requireUser();
  const parsed = requestDeploymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const data = parsed.data;

  // Verify the customer actually owns a license for this application.
  const license = await prisma.applicationLicense.findFirst({
    where: { applicationId: data.applicationId, customerId: user.id, status: "ACTIVE" },
  });
  if (!license) {
    return { status: "error", message: "You don't have an active license for this application." };
  }

  let deploymentTargetId: string | undefined;

  if (data.deploymentType === "CUSTOMER_SERVER") {
    const targetInput = deploymentTargetSchema.safeParse({
      type: "CUSTOMER_SERVER",
      hostname: data.hostname || undefined,
      port: data.port,
      sshUsername: data.sshUsername || undefined,
      operatingSystem: data.operatingSystem || undefined,
      controlPanel: data.controlPanel || undefined,
    });
    if (!targetInput.success) {
      return { status: "error", message: targetInput.error.issues[0]?.message ?? "Invalid server details." };
    }
    if (!data.sshKey) {
      return { status: "error", message: "An SSH private key is required to deploy to your own server." };
    }
    const target = await prisma.deploymentTarget.create({
      data: {
        customerId: user.id,
        type: "CUSTOMER_SERVER",
        provider: "ssh",
        label: "Customer server",
        hostname: targetInput.data.hostname,
        port: targetInput.data.port,
        sshUsername: targetInput.data.sshUsername,
        operatingSystem: targetInput.data.operatingSystem,
        controlPanel: targetInput.data.controlPanel,
        status: "PENDING",
      },
    });
    await prisma.deploymentCredential.create({
      data: { deploymentTargetId: target.id, type: "SSH_KEY", label: "Deployment SSH key", encryptedValue: encryptSecret(data.sshKey) },
    });
    deploymentTargetId = target.id;
  } else if (data.deploymentType === "PLATFORM_HOSTING") {
    if (!data.hostingAccountId) {
      return { status: "error", message: "Select a hosting account to deploy to." };
    }
    const hostingAccount = await prisma.hostingAccount.findFirst({ where: { id: data.hostingAccountId, customerId: user.id } });
    if (!hostingAccount) {
      return { status: "error", message: "Hosting account not found." };
    }
    const target = await prisma.deploymentTarget.create({
      data: {
        customerId: user.id,
        type: "PLATFORM_HOSTING",
        provider: "cloud",
        label: "Platform-managed hosting",
        hostingAccountId: hostingAccount.id,
        status: "ACTIVE",
      },
    });
    deploymentTargetId = target.id;
  }
  // MANAGED: leave deploymentTargetId undefined -- createDeployment lazily creates the mock/managed target.

  const deployment = await createDeployment({
    customerId: user.id,
    applicationId: data.applicationId,
    applicationVersionId: data.applicationVersionId,
    type: data.deploymentType,
    hostingAccountId: data.deploymentType === "PLATFORM_HOSTING" ? data.hostingAccountId || undefined : undefined,
    deploymentTargetId,
  });

  redirect(`/dashboard/deployments/${deployment.id}`);
}

export async function upgradeDeployment(deploymentId: string, formData: FormData) {
  const user = await requireUser();
  const targetVersionId = String(formData.get("targetVersionId") ?? "");
  if (!targetVersionId) throw new Error("Select a version to upgrade to.");

  const upgraded = await upgradeDeploymentService(user.id, deploymentId, targetVersionId);
  redirect(`/dashboard/deployments/${upgraded.id}`);
}
