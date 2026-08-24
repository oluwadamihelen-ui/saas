import Stripe from "stripe";

// Subscription billing has moved to Paystack (see apps/web/src/lib/subscriptions.ts
// and packages/billing/src/paystackClient.ts) — Stripe now powers only
// one-time coin-purchase checkout, pending its own migration to
// Paystack/Korapay in a later phase.

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: "2024-06-20" });
}

export interface CreateCoinCheckoutSessionParams {
  userId: string;
  customerEmail: string;
  productName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  /** Carried through to the completed session/payment_intent so the webhook handler can find the CoinPurchase row without trusting anything else from the client. */
  metadata: Record<string, string>;
}

/**
 * One-time (non-subscription) checkout for a coin package — inline
 * price_data rather than a pre-created Stripe Price object, since coin
 * package prices are admin-configured in our own database (CoinPackage),
 * not synced to Stripe ahead of time.
 */
export async function createCoinCheckoutSession(stripe: Stripe, params: CreateCoinCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: { name: params.productName },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    customer_email: params.customerEmail,
    client_reference_id: params.userId,
    metadata: params.metadata,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

/**
 * Verifies and parses an incoming Stripe webhook. Signature verification
 * (not just JSON.parse) is what makes purchase state trustworthy — the
 * frontend is never treated as a source of truth for billing state
 * (spec §44).
 */
export function constructWebhookEvent(stripe: Stripe, rawBody: string | Buffer, signature: string, webhookSecret: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/** Coin-purchase lifecycle events this platform reacts to. */
export const HANDLED_WEBHOOK_EVENTS = new Set(["checkout.session.completed", "charge.refunded"]);
