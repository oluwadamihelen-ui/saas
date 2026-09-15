import "server-only";
import { safeJson, providerFetch } from "./http";
import type { SmsProvider } from "./types";

/// https://www.twilio.com/docs/sms/api/message-resource#create-a-message-resource
/// — Basic Auth is AccountSid:AuthToken (apiKey holds the Auth Token
/// here), and the body is form-encoded, not JSON, per Twilio's API.
export const twilioProvider: SmsProvider = {
  name: "TWILIO",

  async send({ to, body }, credentials) {
    if (!credentials.accountSid) return { status: "failed", error: "Twilio requires an Account SID." };

    const basicAuth = Buffer.from(`${credentials.accountSid}:${credentials.apiKey}`).toString("base64");
    const form = new URLSearchParams({ To: to, From: credentials.fromIdentifier, Body: body });

    const res = await providerFetch(
      `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      },
      "Twilio"
    );
    if (res.ok) return { status: "sent" };
    const responseBody = await safeJson(res);
    const message = responseBody.message;
    return { status: "failed", error: typeof message === "string" ? message : `Twilio returned ${res.status}.` };
  },
};
