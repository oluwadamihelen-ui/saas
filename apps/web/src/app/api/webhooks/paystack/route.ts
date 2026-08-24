import { NextResponse, type NextRequest } from "next/server";
import { handlePaystackWebhookEvent, PaystackNotConfiguredError, InvalidWebhookSignatureError } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Paystack subscription-lifecycle webhook. Signature-verified inside
 * handlePaystackWebhookEvent (x-paystack-signature, HMAC-SHA512 of the raw
 * body) — never trusts the frontend for subscription state (spec §44).
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();

  try {
    await handlePaystackWebhookEvent(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof PaystackNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof InvalidWebhookSignatureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("Paystack webhook handling failed", error);
    // Non-2xx makes Paystack retry — appropriate for a transient DB error.
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
