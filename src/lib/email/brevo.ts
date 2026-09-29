import { logger } from "@/lib/security/logger";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 8000;

export interface SendEmailInput {
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  text?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("brevo request timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Sends a transactional email through Brevo's HTTP API. Fails OPEN: if
 * BREVO_API_KEY isn't configured, or the call errors or times out, this
 * logs and returns false rather than throwing -- an email provider outage
 * must never break the underlying reservation/payment/check-in action that
 * triggered the notification.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    logger.debug("email.skipped_not_configured", { to: input.to.map((t) => t.email) });
    return false;
  }
  if (input.to.length === 0) return false;

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "hello@otelum.io";
  const senderName = process.env.BREVO_SENDER_NAME ?? "Otelum";

  try {
    const res = await withTimeout(
      fetch(BREVO_API_URL, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          to: input.to,
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
        }),
      }),
      TIMEOUT_MS
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("email.send_failed", { status: res.status, body: body.slice(0, 500) });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("email.send_error", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
