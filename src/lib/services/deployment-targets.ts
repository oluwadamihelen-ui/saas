import { z } from "zod";
import { prisma } from "@/lib/db";
import { DeploymentTargetType } from "@/generated/prisma/client";
import { encryptSecret } from "@/lib/security/encryption";
import { recordAuditLog } from "@/lib/security/audit";

/**
 * Validated shape for a customer-supplied deployment target. Hostname and
 * port are constrained to plausible formats (allowlist-style) rather than
 * accepted as free text -- this is what a hostname/port/command ever reaches
 * the deployment pipeline as, so garbage or malicious input is rejected here
 * instead of being interpolated into anything downstream.
 */
export const deploymentTargetSchema = z.object({
  type: z.enum(["CUSTOMER_SERVER", "PLATFORM_HOSTING", "MANAGED"]),
  label: z.string().trim().max(120).optional(),
  hostname: z
    .string()
    .trim()
    .max(255)
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-.]*[a-zA-Z0-9])?$/, "Enter a valid hostname or IP address (no protocol, no path)")
    .optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  operatingSystem: z.string().trim().max(80).optional(),
  controlPanel: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  hostingPlanId: z.string().uuid().optional(),
  domainId: z.string().uuid().optional(),
});

export type DeploymentTargetInput = z.infer<typeof deploymentTargetSchema>;

const ADAPTER_BY_TYPE: Record<DeploymentTargetType, string> = {
  CUSTOMER_SERVER: "ssh",
  PLATFORM_HOSTING: "cloud",
  MANAGED: "cloud",
  MOCK: "mock",
};

export async function createDeploymentTarget(customerId: string, input: DeploymentTargetInput, credential?: { type: "SSH_KEY" | "API_TOKEN" | "PASSWORD"; label: string; value: string }) {
  const target = await prisma.deploymentTarget.create({
    data: {
      customerId,
      type: input.type,
      provider: ADAPTER_BY_TYPE[input.type],
      label: input.label,
      hostname: input.hostname,
      port: input.port,
      operatingSystem: input.operatingSystem,
      controlPanel: input.controlPanel,
      region: input.region,
      domainId: input.domainId,
      status: "PENDING",
    },
  });

  if (credential) {
    await prisma.deploymentCredential.create({
      data: {
        deploymentTargetId: target.id,
        type: credential.type,
        label: credential.label,
        encryptedValue: encryptSecret(credential.value),
      },
    });
  }

  await recordAuditLog({
    actorId: customerId,
    action: "deployment_target.created",
    resourceType: "DeploymentTarget",
    resourceId: target.id,
    newValue: { type: input.type, hostname: input.hostname ? "[provided]" : null },
  });

  return target;
}

export async function getDeploymentTargetForCustomer(targetId: string, customerId: string) {
  return prisma.deploymentTarget.findFirst({ where: { id: targetId, customerId } });
}

export async function listDeploymentTargetsForCustomer(customerId: string) {
  return prisma.deploymentTarget.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
}

/**
 * A reusable "mock infrastructure" target so a customer can exercise the
 * full deployment flow without owning a server -- created lazily, one per
 * customer, and clearly labeled as demo infrastructure everywhere it's shown.
 */
export async function getOrCreateMockTarget(customerId: string) {
  const existing = await prisma.deploymentTarget.findFirst({ where: { customerId, type: "MOCK" } });
  if (existing) return existing;

  return prisma.deploymentTarget.create({
    data: {
      customerId,
      type: "MOCK",
      provider: "mock",
      label: "Demo Infrastructure (Mock)",
      status: "ACTIVE",
      operatingSystem: "Ubuntu 22.04 (simulated)",
    },
  });
}
