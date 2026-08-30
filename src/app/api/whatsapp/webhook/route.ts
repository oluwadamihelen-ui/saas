import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage, type IncomingMessage } from "@/lib/whatsapp/flow";
import { verifyTwilioSignature, normalizeE164 } from "@/lib/whatsapp/twilio";
import { decryptSecret } from "@/lib/crypto";
import type { Business, WhatsAppAccount } from "@prisma/client";

/**
 * Meta calls this once when the webhook is registered (and whenever the
 * subscription is re-verified) to prove we control this URL. Twilio never
 * calls GET on a webhook, so this only ever matters for the Meta provider.
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // no app secret configured (dev) — skip strict verification
  if (!signatureHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

/**
 * Shared by both providers: given a resolved business/account and one
 * normalized inbound message, upsert the contact/customer/conversation,
 * record the inbound message (idempotent on providerMessageId), run it
 * through the shopping-flow state machine, and persist the new state.
 */
async function processInboundMessage(
  business: Business,
  account: WhatsAppAccount,
  fromWaId: string,
  profileName: string | undefined,
  incoming: IncomingMessage,
  providerMessageId: string,
  rawType: string
) {
  const already = await prisma.conversationMessage.findUnique({ where: { providerMessageId } });
  if (already) return; // idempotent — already processed

  const contact = await prisma.whatsAppContact.upsert({
    where: { whatsAppAccountId_waId: { whatsAppAccountId: account.id, waId: fromWaId } },
    create: { whatsAppAccountId: account.id, waId: fromWaId, profileName },
    update: profileName ? { profileName } : {},
  });

  const customer = await prisma.customer.upsert({
    where: { businessId_phone: { businessId: account.businessId, phone: fromWaId } },
    create: { businessId: account.businessId, phone: fromWaId, name: profileName },
    update: {},
  });

  let conversation = await prisma.conversation.findFirst({
    where: { businessId: account.businessId, contactId: contact.id },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { businessId: account.businessId, contactId: contact.id, customerId: customer.id, channel: "WHATSAPP" },
    });
  }

  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      status: "DELIVERED",
      type: rawType,
      content: incoming as never,
      providerMessageId,
    },
  });

  try {
    const nextState = await handleIncomingMessage(business, account, conversation, fromWaId, incoming);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: nextState as never, lastMessageAt: new Date() },
    });
  } catch (err) {
    console.error("WhatsApp flow error", err);
  }
}

// ---------------------------------------------------------------------------
// Meta WhatsApp Cloud API — JSON payload
// ---------------------------------------------------------------------------

type MetaWebhookPayload = {
  entry: Array<{
    changes: Array<{
      value: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body: string };
          interactive?: {
            type: string;
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string };
          };
        }>;
        statuses?: Array<{ id: string; status: string }>;
      };
    }>;
  }>;
};

async function handleMetaWebhook(rawBody: string, signature: string | null) {
  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const account = await prisma.whatsAppAccount.findFirst({ where: { phoneNumberId, provider: "META" } });
      if (!account) continue; // no business owns this phone number id — ignore

      for (const status of value.statuses ?? []) {
        await prisma.conversationMessage
          .updateMany({ where: { providerMessageId: status.id }, data: { status: status.status.toUpperCase() as never } })
          .catch(() => undefined);
      }

      for (const msg of value.messages ?? []) {
        let incoming: IncomingMessage | null = null;
        if (msg.type === "text" && msg.text) {
          incoming = { type: "text", text: msg.text.body };
        } else if (msg.type === "interactive" && msg.interactive?.button_reply) {
          incoming = { type: "interactive_button", id: msg.interactive.button_reply.id, title: msg.interactive.button_reply.title };
        } else if (msg.type === "interactive" && msg.interactive?.list_reply) {
          incoming = { type: "interactive_list", id: msg.interactive.list_reply.id, title: msg.interactive.list_reply.title };
        }
        if (!incoming) continue;

        const business = await prisma.business.findUnique({ where: { id: account.businessId } });
        if (!business || business.isSuspended) continue;

        const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;
        await processInboundMessage(business, account, msg.from, profileName, incoming, msg.id, msg.type);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Twilio WhatsApp API — application/x-www-form-urlencoded payload
// ---------------------------------------------------------------------------

async function handleTwilioWebhook(req: NextRequest, rawBody: string) {
  const params = new URLSearchParams(rawBody);
  const from = params.get("From"); // "whatsapp:+234..."
  const to = params.get("To"); // "whatsapp:+1415..."
  const body = params.get("Body");
  const messageSid = params.get("MessageSid") || params.get("SmsMessageSid");
  const profileName = params.get("ProfileName") || undefined;

  if (!from || !to || !messageSid) {
    return NextResponse.json({ error: "Invalid Twilio payload" }, { status: 400 });
  }

  const toNumber = normalizeE164(to);
  const account = await prisma.whatsAppAccount.findFirst({ where: { phoneNumberId: toNumber, provider: "TWILIO" } });
  if (!account) {
    // Unknown Twilio number — ack so Twilio doesn't retry.
    return new NextResponse("", { status: 200 });
  }

  if (account.accessTokenEncrypted) {
    const authToken = decryptSecret(account.accessTokenEncrypted);
    const signature = req.headers.get("x-twilio-signature");
    if (authToken && !verifyTwilioSignature(req.url, Object.fromEntries(params), signature, authToken)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const business = await prisma.business.findUnique({ where: { id: account.businessId } });
  if (!business || business.isSuspended) {
    return new NextResponse("", { status: 200 });
  }

  const fromWaId = normalizeE164(from);
  const incoming: IncomingMessage = { type: "text", text: body ?? "" };
  await processInboundMessage(business, account, fromWaId, profileName, incoming, messageSid, "text");

  // Twilio expects an empty 200 (or TwiML) — replies are sent async via the REST API in flow.ts.
  return new NextResponse("", { status: 200, headers: { "Content-Type": "text/xml" } });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return handleTwilioWebhook(req, rawBody);
  }

  const signature = req.headers.get("x-hub-signature-256");
  return handleMetaWebhook(rawBody, signature);
}
