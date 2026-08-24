import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent, createStripeClient, HANDLED_WEBHOOK_EVENTS } from "@cinerra/billing";
import { env } from "@/lib/env";
import { handleCoinPurchaseCompleted, handleCoinPurchaseRefunded } from "@/lib/coinPurchases";

export const dynamic = "force-dynamic";

/**
 * Coin-purchase webhook only — subscription billing moved to Paystack
 * (see /api/webhooks/paystack). Signature-verified, and every handler is
 * idempotent — replays of the same event (Stripe retries on any non-2xx)
 * just upsert the same state.
 */
export async function POST(request: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe is not configured on this server." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(stripe, rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (!HANDLED_WEBHOOK_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.type === "coin_purchase") {
        await handleCoinPurchaseCompleted(session);
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) await handleCoinPurchaseRefunded(paymentIntentId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stripe webhook handling failed", error);
    // Non-2xx makes Stripe retry — appropriate for a transient DB error.
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
