import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent, createStripeClient, HANDLED_WEBHOOK_EVENTS } from "@cinerra/billing";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function mapStatus(status: Stripe.Subscription.Status): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE" {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    default:
      return "INCOMPLETE";
  }
}

/**
 * Stripe webhooks are the ONLY source of subscription truth (spec §44).
 * Signature-verified, and every handler is idempotent — replays of the
 * same event (Stripe retries on any non-2xx) just upsert the same state.
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
    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;
      if (!userId) return NextResponse.json({ received: true, warning: "subscription had no userId metadata" });

      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId
        ? await prisma.plan.findFirst({ where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }] } })
        : null;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planId: plan?.id ?? (await prisma.plan.findUniqueOrThrow({ where: { key: "free" } })).id,
          status: mapStatus(subscription.status),
          interval: plan && priceId === plan.stripePriceIdYearly ? "YEAR" : "MONTH",
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
        update: {
          ...(plan ? { planId: plan.id } : {}),
          status: mapStatus(subscription.status),
          interval: plan && priceId === plan.stripePriceIdYearly ? "YEAR" : "MONTH",
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Stripe webhook handling failed", error);
    // Non-2xx makes Stripe retry — appropriate for a transient DB error.
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
