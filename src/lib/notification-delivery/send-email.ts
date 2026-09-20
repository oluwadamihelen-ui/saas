import "server-only";
import { prisma } from "@/lib/db";
import { resolveActiveEmailProvider } from "./registry";
import { renderNotificationEmail } from "./email-template";
import type { EmailProvider, EmailCredentials, SendEmailResult } from "./types";

export function appOrigin(): string {
  return process.env.APP_URL ?? "http://localhost:3001";
}

export function absoluteUrl(path: string): string {
  return `${appOrigin()}${path}`;
}

function logoUrlFor(schoolId: string, hasLogo: boolean): string | null {
  return hasLogo ? absoluteUrl(`/api/branding/logo/${schoolId}`) : null;
}

/// Renders and sends one branded email through an already-resolved
/// provider — the shared step behind both a notification batch
/// (dispatchExternalChannels in notifications.ts, which resolves the
/// provider once up front for many recipients) and a one-off
/// transactional send (sendSchoolEmail below).
export async function sendBrandedEmail(
  provider: EmailProvider,
  credentials: EmailCredentials,
  school: { id: string; name: string; logoUrl: string | null; brandColor: string | null },
  input: { to: string; subject: string; title: string; body?: string; actionLabel?: string; actionUrl?: string | null; preferencesUrl?: string | null }
): Promise<SendEmailResult> {
  const html = renderNotificationEmail({
    schoolName: school.name,
    logoUrl: logoUrlFor(school.id, Boolean(school.logoUrl)),
    brandColor: school.brandColor,
    title: input.title,
    body: input.body,
    actionLabel: input.actionLabel,
    actionUrl: input.actionUrl ?? null,
    preferencesUrl: input.preferencesUrl ?? null,
  });
  return provider.send({ to: input.to, subject: input.subject, body: html }, credentials);
}

/// One-off transactional email for a flow with no Notification row and
/// often no User account yet (a portal invite, a password reset link) —
/// resolves the school's active/fallback email provider itself rather
/// than requiring the caller to, and records success/failure onto
/// School.lastEmailDeliveryError the same way dispatchExternalChannels
/// does, so a failure here is exactly as visible in Settings as a regular
/// notification's would be.
export async function sendSchoolEmail(
  schoolId: string,
  input: { to: string; subject: string; title: string; body?: string; actionLabel?: string; actionUrl?: string }
): Promise<{ sent: boolean; error?: string }> {
  const [resolved, school] = await Promise.all([
    resolveActiveEmailProvider(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, logoUrl: true, brandColor: true } }),
  ]);
  if (!resolved) return { sent: false, error: "No email provider is available for this school." };
  if (!school) return { sent: false, error: "School not found." };

  const result = await sendBrandedEmail(resolved.provider, resolved.credentials, { id: schoolId, ...school }, input);

  await prisma.school
    .update({
      where: { id: schoolId },
      data:
        result.status === "failed"
          ? { lastEmailDeliveryError: (result.error ?? "The email provider rejected this send.").slice(0, 500), lastEmailDeliveryErrorAt: new Date() }
          : { lastEmailDeliveryError: null, lastEmailDeliveryErrorAt: null },
    })
    .catch((err) => console.error("sendSchoolEmail: failed to record delivery status", err));

  if (result.status === "failed") return { sent: false, error: result.error };
  return { sent: true };
}
