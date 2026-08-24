import {
  createPaystackClient,
  verifyPaystackWebhookSignature,
  HANDLED_PAYSTACK_SUBSCRIPTION_EVENTS,
  HANDLED_PAYSTACK_TRANSFER_EVENTS,
  type PaystackWebhookEvent,
  type PaystackSubscriptionEventData,
  type PaystackInvoiceEventData,
  type PaystackTransferEventData,
} from "@cinerra/billing";
import { prisma } from "./db";
import { env } from "./env";
import { handleCoinPurchaseCompleted, handleCoinPurchaseRefunded } from "./coinPurchases";
import { handlePayoutCompleted, handlePayoutFailed } from "./payouts";

interface PaystackChargeEventData {
  reference: string;
  id: number;
  status: string;
  customer: { email: string };
  metadata?: { type?: string } | null;
}

// Paystack's Refund API response's `data.transaction` object documents a
// `reference` field pointing back at the original charge — the
// refund.processed webhook is understood to mirror that response shape,
// though this hasn't been confirmed against a live payload (no test
// credentials available in this environment). Worth double-checking
// against a real refund.processed delivery before relying on it in
// production.
interface PaystackRefundEventData {
  transaction: { reference: string };
}

export class PaystackNotConfiguredError extends Error {
  constructor() {
    super("Subscriptions aren't available yet — payments aren't configured on this server.");
  }
}
export class PlanNotAvailableError extends Error {
  constructor() {
    super("This plan isn't available for checkout yet. An admin needs to attach a Paystack plan code.");
  }
}
export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super("Invalid webhook signature.");
  }
}
export class NoActiveSubscriptionError extends Error {
  constructor() {
    super("You don't have an active subscription yet.");
  }
}

export async function createSubscriptionCheckout(params: { userId: string; planKey: string; interval: "MONTH" | "YEAR" }): Promise<{ url: string }> {
  if (!env.PAYSTACK_SECRET_KEY) throw new PaystackNotConfiguredError();

  const [user, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: params.userId } }),
    prisma.plan.findUniqueOrThrow({ where: { key: params.planKey } }),
  ]);

  const planCode = params.interval === "MONTH" ? plan.paystackPlanCodeMonthly : plan.paystackPlanCodeYearly;
  if (!planCode) throw new PlanNotAvailableError();

  const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY);
  const amount = params.interval === "MONTH" ? plan.priceMonthlyCents : plan.priceYearlyCents;
  // Unique per checkout attempt — Paystack requires a fresh reference on
  // every /transaction/initialize call, unlike Stripe's session-scoped ids.
  const reference = `sub:${params.userId}:${plan.key}:${params.interval}:${Date.now()}`;

  const result = await paystack.initializeTransaction({
    email: user.email,
    amount,
    reference,
    plan: planCode,
    callbackUrl: `${env.APP_BASE_URL}/pricing?checkout=success`,
    metadata: { userId: params.userId, planKey: plan.key, interval: params.interval },
  });

  return { url: result.authorization_url };
}

/**
 * The single Paystack webhook entry point — signature-verified once here,
 * then dispatched by event type. Paystack webhooks are the ONLY source of
 * both subscription and coin-purchase truth (spec §44, same rule as the
 * earlier Stripe integration). Subscription-lifecycle events are matched
 * to a local user by customer email rather than the metadata passed at
 * checkout — Paystack doesn't reliably echo arbitrary transaction metadata
 * back onto every subscription event, but every event does carry the
 * customer object, and emails are unique in this schema. Coin-purchase
 * events, by contrast, ARE tied directly to the original charge (not a
 * derived subscription object), so those are matched by the reference we
 * generated at checkout instead.
 */
export async function handlePaystackWebhookEvent(rawBody: string, signature: string | null): Promise<void> {
  if (!env.PAYSTACK_SECRET_KEY) throw new PaystackNotConfiguredError();
  if (!signature || !verifyPaystackWebhookSignature(rawBody, signature, env.PAYSTACK_SECRET_KEY)) {
    throw new InvalidWebhookSignatureError();
  }

  const event = JSON.parse(rawBody) as PaystackWebhookEvent;

  if (event.event === "charge.success") {
    const data = event.data as PaystackChargeEventData;
    if (data.metadata?.type === "coin_purchase") {
      await handleCoinPurchaseCompleted({ reference: data.reference, providerTransactionId: String(data.id) });
    }
    return;
  }
  if (event.event === "refund.processed") {
    const data = event.data as PaystackRefundEventData;
    await handleCoinPurchaseRefunded(data.transaction.reference);
    return;
  }
  if (HANDLED_PAYSTACK_TRANSFER_EVENTS.has(event.event)) {
    const data = event.data as PaystackTransferEventData;
    if (event.event === "transfer.success") {
      await handlePayoutCompleted(data.reference);
    } else {
      await handlePayoutFailed(data.reference, data.reason);
    }
    return;
  }

  if (!HANDLED_PAYSTACK_SUBSCRIPTION_EVENTS.has(event.event)) return;

  if (event.event === "invoice.payment_failed") {
    const data = event.data as PaystackInvoiceEventData;
    await prisma.subscription.updateMany({
      where: { paystackSubscriptionCode: data.subscription.subscription_code },
      data: { status: "PAST_DUE" },
    });
    return;
  }

  const data = event.data as PaystackSubscriptionEventData;

  if (event.event === "subscription.not_renew") {
    await prisma.subscription.updateMany({ where: { paystackSubscriptionCode: data.subscription_code }, data: { cancelAtPeriodEnd: true } });
    return;
  }
  if (event.event === "subscription.disable") {
    // Paystack "disable" stops renewal outright — there's no separate
    // "cancel at period end" state on their side the way Stripe has, so
    // this maps straight to CANCELED rather than waiting for a period-end.
    await prisma.subscription.updateMany({ where: { paystackSubscriptionCode: data.subscription_code }, data: { status: "CANCELED", cancelAtPeriodEnd: true } });
    return;
  }

  // subscription.create
  const user = await prisma.user.findUnique({ where: { email: data.customer.email } });
  if (!user) {
    console.error(`[subscriptions] Paystack subscription.create for unknown customer email ${data.customer.email} — ignoring.`);
    return;
  }
  const plan = await prisma.plan.findFirst({ where: { OR: [{ paystackPlanCodeMonthly: data.plan.plan_code }, { paystackPlanCodeYearly: data.plan.plan_code }] } });
  if (!plan) {
    console.error(`[subscriptions] Paystack subscription.create for unknown plan code ${data.plan.plan_code} — ignoring.`);
    return;
  }
  const interval: "MONTH" | "YEAR" = data.plan.plan_code === plan.paystackPlanCodeYearly ? "YEAR" : "MONTH";
  const shared = {
    planId: plan.id,
    status: "ACTIVE" as const,
    interval,
    paystackCustomerCode: data.customer.customer_code,
    paystackSubscriptionCode: data.subscription_code,
    paystackEmailToken: data.email_token,
    currentPeriodEnd: data.next_payment_date ? new Date(data.next_payment_date) : null,
    cancelAtPeriodEnd: false,
  };
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, provider: "PAYSTACK", ...shared },
    update: shared,
  });
}

/**
 * The in-app replacement for Stripe's hosted customer portal — neither
 * Paystack nor Korapay has an equivalent hosted self-service page, so
 * cancellation is a direct API call from our own UI instead. Only calls
 * out to Paystack; the actual status flip to CANCELED still comes from
 * the subsequent subscription.disable webhook, same "webhook is truth"
 * rule as everywhere else in this billing system.
 */
export async function cancelSubscription(userId: string): Promise<void> {
  if (!env.PAYSTACK_SECRET_KEY) throw new PaystackNotConfiguredError();

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription?.paystackSubscriptionCode || !subscription.paystackEmailToken) {
    throw new NoActiveSubscriptionError();
  }

  const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY);
  await paystack.disableSubscription({ code: subscription.paystackSubscriptionCode, token: subscription.paystackEmailToken });
}
