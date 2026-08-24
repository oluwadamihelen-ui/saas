import { NextResponse, type NextRequest } from "next/server";
import { handleKorapayWebhookEvent, KorapayNotConfiguredError, InvalidKorapayWebhookSignatureError } from "@/lib/coinPurchases";

export const dynamic = "force-dynamic";

/**
 * Korapay coin-purchase webhook. Signature-verified inside
 * handleKorapayWebhookEvent (x-korapay-signature, HMAC-SHA256 of just the
 * `data` object) — never trusts the frontend for purchase state (spec §44).
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-korapay-signature");
  const rawBody = await request.text();

  try {
    await handleKorapayWebhookEvent(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof KorapayNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof InvalidKorapayWebhookSignatureError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("Korapay webhook handling failed", error);
    // Non-2xx makes Korapay retry — appropriate for a transient DB error.
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
