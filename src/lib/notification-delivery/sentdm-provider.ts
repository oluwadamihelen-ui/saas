import "server-only";
import { safeJson, providerFetch } from "./http";
import type { SmsProvider } from "./types";

const BASE_URL = "https://api.sent.dm/v1";

/// Sent.dm's SMS send endpoint, best-effort against their published REST
/// conventions (bearer-token auth, JSON body) — verify the exact path/
/// field names against https://sent.dm's current API docs before relying
/// on this in production, since their API is newer and less
/// battle-tested here than Resend/Twilio's.
export const sentdmProvider: SmsProvider = {
  name: "SENTDM",

  async send({ to, body }, credentials) {
    const res = await providerFetch(
      `${BASE_URL}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, from: credentials.fromIdentifier, body }),
      },
      "Sent.dm"
    );
    if (res.ok) return { status: "sent" };
    const responseBody = await safeJson(res);
    const message = responseBody.message ?? responseBody.error;
    return { status: "failed", error: typeof message === "string" ? message : `Sent.dm returned ${res.status}.` };
  },
};
