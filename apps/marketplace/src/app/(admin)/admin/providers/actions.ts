"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { recordAuditLog } from "@/lib/security/audit";
import { MockPaymentProvider } from "@/lib/providers/payment/mock";
import { PaystackPaymentProvider } from "@/lib/providers/payment/paystack";
import { MockDomainProvider } from "@/lib/providers/domain/mock";
import { MockHostingProvider } from "@/lib/providers/hosting/mock";
import { MockDeploymentProvider } from "@/lib/providers/deployment/mock";
import { MockEmailProvider } from "@/lib/providers/email/mock";
import type { ProviderAdapterBase } from "@/lib/providers/types";

async function resolveAdapter(providerId: string): Promise<ProviderAdapterBase | null> {
  const provider = await prisma.provider.findUniqueOrThrow({ where: { id: providerId }, include: { credentials: true } });

  if (provider.adapterKey === "mock") {
    switch (provider.type) {
      case "PAYMENT":
        return new MockPaymentProvider();
      case "DOMAIN":
        return new MockDomainProvider();
      case "HOSTING":
        return new MockHostingProvider();
      case "DEPLOYMENT":
        return new MockDeploymentProvider();
      case "EMAIL":
        return new MockEmailProvider();
      default:
        return null;
    }
  }

  if (provider.adapterKey === "paystack") {
    const secretCred = provider.credentials.find((c) => c.key === "secretKey");
    if (!secretCred) return null;
    return new PaystackPaymentProvider(decryptSecret(secretCred.encryptedValue));
  }

  return null;
}

export async function testProviderConnection(providerId: string) {
  const user = await requirePermission(PERMISSIONS.PROVIDERS_MANAGE);
  const adapter = await resolveAdapter(providerId);

  if (!adapter) {
    await prisma.provider.update({
      where: { id: providerId },
      data: { mode: "ERROR", lastTestedAt: new Date(), lastTestResult: "Adapter not configured" },
    });
    revalidatePath("/admin/providers");
    return;
  }

  const result = await adapter.testConnection();
  await prisma.provider.update({
    where: { id: providerId },
    data: {
      mode: result.state === "CONNECTED" ? "CONNECTED" : "ERROR",
      lastTestedAt: new Date(),
      lastTestResult: `${result.state}: ${result.message}`,
    },
  });

  await recordAuditLog({ actorId: user.id, action: "provider.tested", resourceType: "Provider", resourceId: providerId, newValue: { result: result.state } });
  revalidatePath("/admin/providers");
}

const credentialSchema = z.object({ key: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(2000) });

export async function saveProviderCredential(providerId: string, formData: FormData) {
  const user = await requirePermission(PERMISSIONS.PROVIDERS_MANAGE);
  const parsed = credentialSchema.parse({ key: formData.get("key"), value: formData.get("value") });

  const encryptedValue = encryptSecret(parsed.value);

  await prisma.providerCredential.upsert({
    where: { providerId_key: { providerId, key: parsed.key } },
    update: { encryptedValue },
    create: { providerId, key: parsed.key, encryptedValue },
  });

  await prisma.provider.update({ where: { id: providerId }, data: { mode: "CONFIGURED" } });

  await recordAuditLog({ actorId: user.id, action: "provider.credential_saved", resourceType: "Provider", resourceId: providerId, newValue: { key: parsed.key } });
  revalidatePath("/admin/providers");
}
