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
import { KoraPayPaymentProvider } from "@/lib/providers/payment/korapay";
import { NowPaymentsPaymentProvider } from "@/lib/providers/payment/nowpayments";
import { MockDomainProvider } from "@/lib/providers/domain/mock";
import { NamecheapDomainProvider } from "@/lib/providers/domain/namecheap";
import { MockHostingProvider } from "@/lib/providers/hosting/mock";
import { CPanelHostingProvider } from "@/lib/providers/hosting/cpanel";
import { MockDeploymentProvider } from "@/lib/providers/deployment/mock";
import { MockEmailProvider } from "@/lib/providers/email/mock";
import { ResendEmailProvider } from "@/lib/providers/email/resend";
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

  if (provider.adapterKey === "resend") {
    const apiKeyCred = provider.credentials.find((c) => c.key === "apiKey");
    if (!apiKeyCred) return null;
    return new ResendEmailProvider(decryptSecret(apiKeyCred.encryptedValue));
  }

  if (provider.adapterKey === "korapay") {
    const secretCred = provider.credentials.find((c) => c.key === "secretKey");
    if (!secretCred) return null;
    return new KoraPayPaymentProvider(decryptSecret(secretCred.encryptedValue));
  }

  if (provider.adapterKey === "nowpayments") {
    const apiKeyCred = provider.credentials.find((c) => c.key === "apiKey");
    const ipnSecretCred = provider.credentials.find((c) => c.key === "ipnSecret");
    if (!apiKeyCred || !ipnSecretCred) return null;
    return new NowPaymentsPaymentProvider(decryptSecret(apiKeyCred.encryptedValue), decryptSecret(ipnSecretCred.encryptedValue));
  }

  if (provider.adapterKey === "cpanel") {
    const find = (key: string) => provider.credentials.find((c) => c.key === key);
    const hostCred = find("host");
    const usernameCred = find("username");
    const apiTokenCred = find("apiToken");
    if (!hostCred || !usernameCred || !apiTokenCred) return null;
    const portCred = find("port");
    return new CPanelHostingProvider({
      host: decryptSecret(hostCred.encryptedValue),
      username: decryptSecret(usernameCred.encryptedValue),
      apiToken: decryptSecret(apiTokenCred.encryptedValue),
      port: portCred ? Number(decryptSecret(portCred.encryptedValue)) : undefined,
    });
  }

  if (provider.adapterKey === "namecheap") {
    const find = (key: string) => provider.credentials.find((c) => c.key === key);
    const apiUserCred = find("apiUser");
    const apiKeyCred = find("apiKey");
    const usernameCred = find("username");
    const clientIpCred = find("clientIp");
    if (!apiUserCred || !apiKeyCred || !usernameCred || !clientIpCred) return null;
    return new NamecheapDomainProvider({
      apiUser: decryptSecret(apiUserCred.encryptedValue),
      apiKey: decryptSecret(apiKeyCred.encryptedValue),
      username: decryptSecret(usernameCred.encryptedValue),
      clientIp: decryptSecret(clientIpCred.encryptedValue),
      sandbox: process.env.NAMECHEAP_SANDBOX !== "false",
    });
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
