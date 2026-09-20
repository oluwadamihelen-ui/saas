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

/// Schoolum's own Resend account, used for any school that hasn't
/// connected its own provider — most schools never will, since setting up
/// a sending domain in Resend is too technical for them. This is the
/// fallback path, not the preferred one: a school's own configured
/// provider (checked first, below) always takes priority.
function platformEmailProvider(): { provider: EmailProvider; credentials: EmailCredentials } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) return null;
  return { provider: resendProvider, credentials: { apiKey, fromEmail } };
}

/// Resolves the email provider to send through for a school: its own
/// connected, enabled provider if configured, else Schoolum's
/// platform-wide Resend account, else null if neither is available.
export async function resolveActiveEmailProvider(
  schoolId: string
): Promise<{ provider: EmailProvider; credentials: EmailCredentials } | null> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { activeEmailProvider: true } });

  if (school?.activeEmailProvider) {
    const credential = await prisma.notificationProviderCredential.findUnique({
      where: { schoolId_provider: { schoolId, provider: school.activeEmailProvider } },
    });
    const provider = credential?.isEnabled ? EMAIL_ADAPTERS[school.activeEmailProvider] : undefined;
    if (credential?.isEnabled && provider) {
      return { provider, credentials: { apiKey: decryptSecret(credential.apiKeyEnc), fromEmail: credential.fromIdentifier } };
    }
  }

  return platformEmailProvider();
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
