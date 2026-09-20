import "server-only";
import { safeJson, providerFetch } from "./http";
import type { EmailProvider } from "./types";

const BASE_URL = "https://api.resend.com";

/// https://resend.com/docs/api-reference/emails/send-email — fromEmail
/// must be on a domain the school has verified in their own Resend
/// account; Resend rejects sends from an unverified domain.
export const resendProvider: EmailProvider = {
  name: "RESEND",

  async send({ to, subject, body }, credentials) {
    const res = await providerFetch(
      `${BASE_URL}/emails`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: credentials.fromEmail, to: [to], subject, html: body }),
      },
      "Resend"
    );
    if (res.ok) return { status: "sent" };
    const responseBody = await safeJson(res);
    const message = responseBody.message;
    return { status: "failed", error: typeof message === "string" ? message : `Resend returned ${res.status}.` };
  },
};
