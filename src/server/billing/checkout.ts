import { prisma } from "@/server/db/client";
import { getStripeClient } from "./stripe";
import { getStripePriceIdForPlan, getStripePriceIdForCreditPack, CREDIT_PACKS, type CreditPack } from "@/lib/plans";
import type { PlanId } from "@/generated/prisma/enums";

function baseUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

async function getOrCreateStripeCustomerId(userId: string): Promise<string> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ email: user.email, metadata: { userId } });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createSubscriptionCheckoutUrl(userId: string, plan: PlanId): Promise<string> {
  if (plan === "FREE") throw new Error("The free plan doesn't need checkout.");

  const priceId = getStripePriceIdForPlan(plan);
  if (!priceId) throw new Error(`No Stripe price is configured for the ${plan} plan yet.`);

  const customerId = await getOrCreateStripeCustomerId(userId);
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl()}/billing?checkout=success`,
    cancel_url: `${baseUrl()}/billing?checkout=cancelled`,
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createCreditPackCheckoutUrl(userId: string, packId: CreditPack["id"]): Promise<string> {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Unknown credit pack.");

  const priceId = getStripePriceIdForCreditPack(packId);
  if (!priceId) throw new Error(`No Stripe price is configured for the ${pack.name} pack yet.`);

  const customerId = await getOrCreateStripeCustomerId(userId);
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl()}/billing?checkout=success`,
    cancel_url: `${baseUrl()}/billing?checkout=cancelled`,
    metadata: { userId, type: "credit_pack", packId, credits: String(pack.credits) },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createBillingPortalUrl(userId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeCustomerId) {
    throw new Error("No billing account yet — start a checkout first.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${baseUrl()}/billing`,
  });

  return session.url;
}
