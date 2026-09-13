import "server-only";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { resendProvider } from "./resend-provider";
import { twilioProvider } from "./twilio-provider";
import { sentdmProvider } from "./sentdm-provider";
import type { EmailCredentials, EmailProvider, SmsCredentials, SmsProvider } from "./types";
import type { NotificationDeliveryProvider } from "@/generated/prisma/client";

export const EMAIL_PROVIDERS: NotificationDeliveryProvider[] = ["RESEND"];
export const SMS_PROVIDERS: NotificationDeliveryProvider[] = ["TWILIO", "SENTDM"];

const EMAIL_ADAPTERS: Partial<Record<NotificationDeliveryProvider, EmailProvider>> = {
  RESEND: resendProvider,
};
const SMS_ADAPTERS: Partial<Record<NotificationDeliveryProvider, SmsProvider>> = {
  TWILIO: twilioProvider,
  SENTDM: sentdmProvider,
};

/// Resolves the school's currently active, connected, enabled email
/// provider — null if none is configured (email sends are then silently
/// skipped, exactly like an unconnected payment gateway falls back to the
/// mock rather than erroring, except there's no mock for email/SMS).
export async function resolveActiveEmailProvider(
  schoolId: string
): Promise<{ provider: EmailProvider; credentials: EmailCredentials } | null> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { activeEmailProvider: true } });
  if (!school?.activeEmailProvider) return null;

  const credential = await prisma.notificationProviderCredential.findUnique({
    where: { schoolId_provider: { schoolId, provider: school.activeEmailProvider } },
  });
  if (!credential || !credential.isEnabled) return null;

  const provider = EMAIL_ADAPTERS[school.activeEmailProvider];
  if (!provider) return null;

  return { provider, credentials: { apiKey: decryptSecret(credential.apiKeyEnc), fromEmail: credential.fromIdentifier } };
}

export async function resolveActiveSmsProvider(
  schoolId: string
): Promise<{ provider: SmsProvider; credentials: SmsCredentials } | null> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { activeSmsProvider: true } });
  if (!school?.activeSmsProvider) return null;

  const credential = await prisma.notificationProviderCredential.findUnique({
    where: { schoolId_provider: { schoolId, provider: school.activeSmsProvider } },
  });
  if (!credential || !credential.isEnabled) return null;

  const provider = SMS_ADAPTERS[school.activeSmsProvider];
  if (!provider) return null;

  return {
    provider,
    credentials: {
      apiKey: decryptSecret(credential.apiKeyEnc),
      fromIdentifier: credential.fromIdentifier,
      accountSid: credential.accountSidEnc ? decryptSecret(credential.accountSidEnc) : undefined,
    },
  };
}
