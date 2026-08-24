import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/server/billing/stripe";
import { prisma } from "@/server/db/client";
import { applyCreditDelta } from "@/server/credits/ledger";
import { PLANS, getPlanForStripePriceId } from "@/lib/plans";
import type { SubscriptionStatus, PlanId } from "@/generated/prisma/enums";

// Stripe requires the raw, unparsed request body to verify the webhook
// signature — never call req.json() before constructEvent.
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  if (session.mode === "subscription") {
    const plan = session.metadata?.plan as PlanId | undefined;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!plan || !subscriptionId) return;

    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan, status: "ACTIVE", stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId },
      update: { plan, status: "ACTIVE", stripeSubscriptionId: subscriptionId },
    });

    await applyCreditDelta(userId, PLANS[plan].monthlyCredits, "MONTHLY_GRANT", {
      via: "checkout",
      stripeSubscriptionId: subscriptionId,
    });
  } else if (session.mode === "payment" && session.metadata?.type === "credit_pack") {
    const credits = Number(session.metadata.credits ?? 0);
    if (credits > 0) {
      await applyCreditDelta(userId, credits, "PURCHASE", { packId: session.metadata.packId });
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const item = subscription.items.data[0];
  const plan = getPlanForStripePriceId(item?.price?.id);

  await prisma.subscription.updateMany({
    where: { userId },
    data: {
      status: mapStripeStatus(subscription.status),
      ...(plan ? { plan } : {}),
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await prisma.subscription.updateMany({
    where: { userId },
    data: { plan: "FREE", status: "CANCELED", stripeSubscriptionId: null, cancelAtPeriodEnd: false },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only recurring renewals grant fresh credits — the initial period's
  // credits are already granted by handleCheckoutCompleted.
  if (invoice.billing_reason !== "subscription_cycle") return;

  const subscriptionId = invoice.parent?.subscription_details?.subscription;
  const id = typeof subscriptionId === "string" ? subscriptionId : subscriptionId?.id;
  if (!id) return;

  const sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: id } });
  if (!sub) return;

  await applyCreditDelta(sub.userId, PLANS[sub.plan].monthlyCredits, "MONTHLY_GRANT", {
    via: "renewal",
    stripeInvoiceId: invoice.id,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.parent?.subscription_details?.subscription;
  const id = typeof subscriptionId === "string" ? subscriptionId : subscriptionId?.id;
  if (!id) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: id },
    data: { status: "PAST_DUE" },
  });
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "ACTIVE";
  }
}
