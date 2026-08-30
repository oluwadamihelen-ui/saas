import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage, type IncomingMessage } from "@/lib/whatsapp/flow";

/**
 * Meta calls this once when the webhook is registered (and whenever the
 * subscription is re-verified) to prove we control this URL.
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

type WhatsAppWebhookPayload = {
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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
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

      const account = await prisma.whatsAppAccount.findFirst({ where: { phoneNumberId } });
      if (!account) continue; // no business owns this phone number id — ignore

      // Message status updates (sent/delivered/read/failed).
      for (const status of value.statuses ?? []) {
        await prisma.conversationMessage
          .updateMany({
            where: { providerMessageId: status.id },
            data: { status: status.status.toUpperCase() as never },
          })
          .catch(() => undefined);
      }

      for (const msg of value.messages ?? []) {
        // Idempotency: skip if we've already recorded this inbound message id.
        const already = await prisma.conversationMessage.findUnique({ where: { providerMessageId: msg.id } });
        if (already) continue;

        const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;

        const contact = await prisma.whatsAppContact.upsert({
          where: { whatsAppAccountId_waId: { whatsAppAccountId: account.id, waId: msg.from } },
          create: { whatsAppAccountId: account.id, waId: msg.from, profileName },
          update: profileName ? { profileName } : {},
        });

        const customer = await prisma.customer.upsert({
          where: { businessId_phone: { businessId: account.businessId, phone: msg.from } },
          create: { businessId: account.businessId, phone: msg.from, name: profileName },
          update: {},
        });

        let conversation = await prisma.conversation.findFirst({
          where: { businessId: account.businessId, contactId: contact.id },
        });
        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              businessId: account.businessId,
              contactId: contact.id,
              customerId: customer.id,
              channel: "WHATSAPP",
            },
          });
        }

        let incoming: IncomingMessage | null = null;
        if (msg.type === "text" && msg.text) {
          incoming = { type: "text", text: msg.text.body };
        } else if (msg.type === "interactive" && msg.interactive?.button_reply) {
          incoming = { type: "interactive_button", id: msg.interactive.button_reply.id, title: msg.interactive.button_reply.title };
        } else if (msg.type === "interactive" && msg.interactive?.list_reply) {
          incoming = { type: "interactive_list", id: msg.interactive.list_reply.id, title: msg.interactive.list_reply.title };
        }

        await prisma.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            direction: "INBOUND",
            status: "DELIVERED",
            type: msg.type,
            content: (incoming ?? { raw: msg }) as never,
            providerMessageId: msg.id,
          },
        });

        if (!incoming) continue;

        const business = await prisma.business.findUnique({ where: { id: account.businessId } });
        if (!business || business.isSuspended) continue;

        try {
          const nextState = await handleIncomingMessage(business, account, conversation, msg.from, incoming);
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { state: nextState as never, lastMessageAt: new Date() },
          });
        } catch (err) {
          console.error("WhatsApp flow error", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
