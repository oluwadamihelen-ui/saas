import "server-only";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { EMAIL_PROVIDERS, SMS_PROVIDERS } from "@/lib/notification-delivery/registry";
import type { NotificationDeliveryProvider } from "@/generated/prisma/client";

export async function listNotificationProviderCredentials(schoolId: string) {
  return prisma.notificationProviderCredential.findMany({ where: { schoolId }, orderBy: { provider: "asc" } });
}

export interface SaveNotificationProviderCredentialInput {
  provider: NotificationDeliveryProvider;
  fromIdentifier: string;
  /// Undefined keeps the existing key unchanged (edit flow) — a school
  /// re-entering its from-identifier or flipping "enabled" shouldn't have
  /// to paste the API key back in every time.
  apiKey?: string;
  /// Twilio-only — ignored for every other provider.
  accountSid?: string;
  isEnabled: boolean;
}

export async function saveNotificationProviderCredential(schoolId: string, input: SaveNotificationProviderCredentialInput) {
  const existing = await prisma.notificationProviderCredential.findUnique({
    where: { schoolId_provider: { schoolId, provider: input.provider } },
  });
  if (!existing && !input.apiKey) {
    throw new Error("Enter the API key to connect this provider.");
  }
  if (input.provider === "TWILIO" && !existing?.accountSidEnc && !input.accountSid) {
    throw new Error("Twilio requires an Account SID.");
  }

  // Deliberately two separate calls, not prisma's upsert({create, update})
  // — a JS object literal evaluates every property eagerly, so an
  // upsert's unused `create` branch would still call encryptSecret(
  // input.apiKey!) on every edit that leaves the key blank (the
  // documented "leave blank to keep existing" flow) and crash on the
  // undefined, even though only `update` was ever going to run.
  if (existing) {
    return prisma.notificationProviderCredential.update({
      where: { schoolId_provider: { schoolId, provider: input.provider } },
      data: {
        fromIdentifier: input.fromIdentifier,
        ...(input.apiKey ? { apiKeyEnc: encryptSecret(input.apiKey) } : {}),
        ...(input.accountSid !== undefined ? { accountSidEnc: input.accountSid ? encryptSecret(input.accountSid) : null } : {}),
        isEnabled: input.isEnabled,
      },
    });
  }
  return prisma.notificationProviderCredential.create({
    data: {
      schoolId,
      provider: input.provider,
      fromIdentifier: input.fromIdentifier,
      apiKeyEnc: encryptSecret(input.apiKey!),
      accountSidEnc: input.accountSid ? encryptSecret(input.accountSid) : null,
      isEnabled: input.isEnabled,
    },
  });
}

/// Disconnecting the school's currently *active* provider for its channel
/// clears that active-provider field too, so sends for that channel are
/// simply skipped rather than pointing at credentials that no longer
/// exist — same reasoning as removeGatewayCredential.
export async function removeNotificationProviderCredential(schoolId: string, provider: NotificationDeliveryProvider) {
  await prisma.notificationProviderCredential.deleteMany({ where: { schoolId, provider } });
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { activeEmailProvider: true, activeSmsProvider: true } });
  if (school?.activeEmailProvider === provider) {
    await prisma.school.update({ where: { id: schoolId }, data: { activeEmailProvider: null } });
  }
  if (school?.activeSmsProvider === provider) {
    await prisma.school.update({ where: { id: schoolId }, data: { activeSmsProvider: null } });
  }
}

async function setActiveProvider(schoolId: string, channel: "email" | "sms", provider: NotificationDeliveryProvider | null) {
  const allowedProviders = channel === "email" ? EMAIL_PROVIDERS : SMS_PROVIDERS;
  if (provider) {
    if (!allowedProviders.includes(provider)) {
      throw new Error(`${provider} is not a ${channel} provider.`);
    }
    const credential = await prisma.notificationProviderCredential.findUnique({
      where: { schoolId_provider: { schoolId, provider } },
    });
    if (!credential || !credential.isEnabled) throw new Error("Connect and enable this provider before making it active.");
  }
  return prisma.school.update({
    where: { id: schoolId },
    data: channel === "email" ? { activeEmailProvider: provider } : { activeSmsProvider: provider },
  });
}

export async function setActiveEmailProvider(schoolId: string, provider: NotificationDeliveryProvider | null) {
  return setActiveProvider(schoolId, "email", provider);
}

export async function setActiveSmsProvider(schoolId: string, provider: NotificationDeliveryProvider | null) {
  return setActiveProvider(schoolId, "sms", provider);
}
