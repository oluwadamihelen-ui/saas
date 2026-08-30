import "server-only";
import crypto from "crypto";

/**
 * Twilio's WhatsApp API — used as an alternate transport to Meta's raw
 * Cloud API for businesses that can't (or don't want to) set up their own
 * Meta Business Portfolio. Twilio is a Meta-certified WhatsApp Business
 * Solution Provider, so this stays within "official platform only."
 *
 * Twilio has no native equivalent of Meta's interactive button/list
 * messages on the sandbox/basic API — see client.ts, which renders those
 * as numbered plain text instead, and lib/whatsapp/flow.ts, which accepts
 * a typed number or the option's name as a plain-text reply.
 */

export async function sendTwilioWhatsAppMessage(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  body: string
): Promise<{ sid: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const params = new URLSearchParams({
    From: `whatsapp:${normalizeE164(fromNumber)}`,
    To: `whatsapp:${normalizeE164(toNumber)}`,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const rawBody = await res.text();
  let data: { sid?: string; message?: string } = {};
  try {
    data = JSON.parse(rawBody);
  } catch {
    // Twilio returns plain text/HTML for some transport-level failures
    // (e.g. an invalid Account SID never reaches their JSON API layer).
  }

  if (!res.ok) {
    throw new Error(data.message || `Twilio API request failed (${res.status}): ${rawBody.slice(0, 200)}`);
  }
  if (!data.sid) {
    throw new Error(`Unexpected Twilio response: ${rawBody.slice(0, 200)}`);
  }
  return { sid: data.sid };
}

export function normalizeE164(phone: string): string {
  return phone.replace(/^whatsapp:/, "").trim();
}

/**
 * Verifies Twilio's X-Twilio-Signature header: base64(HMAC-SHA1(authToken,
 * fullUrl + sorted "key" + "value" pairs concatenated)).
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string
): boolean {
  if (!signature) return false;

  const data =
    fullUrl +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");

  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
