import "server-only";
import { decryptSecret } from "@/lib/crypto";

const GRAPH_VERSION = "v21.0";

export type WhatsAppSendableAccount = {
  phoneNumberId: string | null;
  accessTokenEncrypted: string | null;
};

function resolveCredentials(account: WhatsAppSendableAccount) {
  const phoneNumberId = account.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = account.accessTokenEncrypted
    ? decryptSecret(account.accessTokenEncrypted)
    : process.env.WHATSAPP_ACCESS_TOKEN;
  return { phoneNumberId, accessToken };
}

async function callGraphApi(phoneNumberId: string, accessToken: string, body: Record<string, unknown>) {
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
  return data as { messages: [{ id: string }] };
}

export async function sendText(account: WhatsAppSendableAccount, to: string, body: string) {
  const { phoneNumberId, accessToken } = resolveCredentials(account);
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
) {
  const { phoneNumberId, accessToken } = resolveCredentials(account);
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
) {
  const { phoneNumberId, accessToken } = resolveCredentials(account);
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
