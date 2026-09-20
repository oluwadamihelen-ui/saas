import "server-only";
import { resolveActiveSmsProvider } from "./registry";

/// One-off transactional SMS for a flow with no Notification row (e.g.
/// handing a freshly generated student password to a guardian) — mirrors
/// sendSchoolEmail's shape, but there's no platform-wide SMS fallback (see
/// registry.ts: SMS is opt-in and always the school's own connected
/// provider, since it costs the school money) and no School column to
/// record delivery failures onto, so this just reports the result back to
/// the caller to surface however it needs to.
export async function sendSchoolSms(schoolId: string, to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const resolved = await resolveActiveSmsProvider(schoolId);
  if (!resolved) return { sent: false, error: "No SMS provider is configured for this school." };

  const result = await resolved.provider.send({ to, body }, resolved.credentials);
  if (result.status === "failed") return { sent: false, error: result.error ?? "The SMS provider rejected this send." };
  return { sent: true };
}
