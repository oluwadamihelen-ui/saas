import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { sendTwilioWhatsAppMessage } from "@/lib/whatsapp/twilio";

const GRAPH_VERSION = "v21.0";

export type WhatsAppSendableAccount = {
  provider?: "META" | "TWILIO" | null;
  phoneNumberId: string | null; // Meta: Phone Number ID. Twilio: the WhatsApp-enabled Twilio number.
  wabaId?: string | null; // Meta: WABA ID (unused for sending). Twilio: Account SID.
  accessTokenEncrypted: string | null; // Meta: access token. Twilio: Auth Token.
};

type SendResult = { messages: [{ id: string }] };

function resolveMetaCredentials(account: WhatsAppSendableAccount) {
  const phoneNumberId = account.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = account.accessTokenEncrypted
    ? decryptSecret(account.accessTokenEncrypted)
    : process.env.WHATSAPP_ACCESS_TOKEN;
  return { phoneNumberId, accessToken };
}

async function callGraphApi(phoneNumberId: string, accessToken: string, body: Record<string, unknown>): Promise<SendResult> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "WhatsApp API request failed");
  }
  return data as SendResult;
}

async function sendTextViaTwilio(account: WhatsAppSendableAccount, to: string, body: string): Promise<SendResult> {
  const fromNumber = account.phoneNumberId;
  const accountSid = account.wabaId;
  const authToken = account.accessTokenEncrypted ? decryptSecret(account.accessTokenEncrypted) : null;
  if (!fromNumber || !accountSid || !authToken) {
    throw new Error("WhatsApp (Twilio) is not connected for this business");
  }
  const result = await sendTwilioWhatsAppMessage(accountSid, authToken, fromNumber, to, body);
  return { messages: [{ id: result.sid }] };
}

/**
 * Renders a Meta-style button/list prompt as numbered plain text, since
 * Twilio's WhatsApp API has no equivalent of Meta's interactive messages
 * without pre-approved Content Templates. lib/whatsapp/flow.ts accepts a
 * typed number or option name as a plain-text reply, so the shopping flow
 * still works end-to-end over Twilio — just less tap-friendly.
 */
function renderOptionsAsText(bodyText: string, options: Array<{ title: string }>): string {
  const lines = options.map((o, i) => `${i + 1}. ${o.title}`);
  return [bodyText, "", ...lines, "", "Reply with a number or type your choice."].join("\n");
}

export async function sendText(account: WhatsAppSendableAccount, to: string, body: string): Promise<SendResult> {
  if (account.provider === "TWILIO") {
    return sendTextViaTwilio(account, to, body);
  }
  const { phoneNumberId, accessToken } = resolveMetaCredentials(account);
  if (!phoneNumberId || !accessToken) throw new Error("WhatsApp is not connected for this business");
  return callGraphApi(phoneNumberId, accessToken, {
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

export async function sendButtons(
  account: WhatsAppSendableAccount,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<SendResult> {
  if (account.provider === "TWILIO") {
    return sendTextViaTwilio(account, to, renderOptionsAsText(bodyText, buttons));
  }
  const { phoneNumberId, accessToken } = resolveMetaCredentials(account);
  if (!phoneNumberId || !accessToken) throw new Error("WhatsApp is not connected for this business");
  return callGraphApi(phoneNumberId, accessToken, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
      },
    },
  });
}

export async function sendList(
  account: WhatsAppSendableAccount,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
): Promise<SendResult> {
  if (account.provider === "TWILIO") {
    const allRows = sections.flatMap((s) => s.rows);
    return sendTextViaTwilio(account, to, renderOptionsAsText(bodyText, allRows));
  }
  const { phoneNumberId, accessToken } = resolveMetaCredentials(account);
  if (!phoneNumberId || !accessToken) throw new Error("WhatsApp is not connected for this business");
  return callGraphApi(phoneNumberId, accessToken, {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72),
          })),
        })),
      },
    },
  });
}
