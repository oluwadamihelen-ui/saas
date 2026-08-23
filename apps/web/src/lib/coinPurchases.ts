import { createCoinCheckoutSession, createStripeClient } from "@cinerra/billing";
import type Stripe from "stripe";
import { prisma } from "./db";
import { env } from "./env";
import { recordWalletTransaction, isUniqueConstraintViolation } from "./wallet";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Buying coins isn't available yet — payments aren't configured on this server.");
  }
}
export class CoinPackageUnavailableError extends Error {
  constructor() {
    super("That coin package isn't available.");
  }
}

export async function createCoinPurchaseCheckout(params: { userId: string; coinPackageId: string }) {
  if (!env.STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();

  const [user, coinPackage] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: params.userId } }),
    prisma.coinPackage.findUnique({ where: { id: params.coinPackageId } }),
  ]);
  if (!coinPackage || !coinPackage.active) throw new CoinPackageUnavailableError();

  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
  const totalCoins = coinPackage.coins + coinPackage.bonusCoins;

  const session = await createCoinCheckoutSession(stripe, {
    userId: params.userId,
    customerEmail: user.email,
    productName: `${coinPackage.coins.toLocaleString()} Cinerra Coins${coinPackage.bonusCoins ? ` (+${coinPackage.bonusCoins} bonus)` : ""}`,
    amountCents: coinPackage.priceCents,
    currency: coinPackage.currency,
    successUrl: `${env.APP_BASE_URL}/wallet?checkout=success`,
    cancelUrl: `${env.APP_BASE_URL}/wallet?checkout=cancelled`,
    // The webhook resolves everything it needs (package, coins, price) from
    // this session id joined back to the CoinPurchase row it creates below
    // — never from anything Stripe echoes back that could be tampered with
    // client-side, since Stripe's own webhook signature only guarantees the
    // event itself is authentic, not that a client didn't manipulate an
    // unrelated field.
    metadata: { type: "coin_purchase", userId: params.userId, coinPackageId: coinPackage.id },
  });

  // The PENDING row is created now, before the webhook — its unique
  // stripeCheckoutSessionId is what makes crediting idempotent: the
  // webhook only ever transitions this exact row from PENDING to
  // COMPLETED, and a replayed event finds it already COMPLETED and no-ops.
  await prisma.coinPurchase.create({
    data: {
      userId: params.userId,
      coinPackageId: coinPackage.id,
      coinsCredited: totalCoins,
      amountCents: coinPackage.priceCents,
      currency: coinPackage.currency,
      status: "PENDING",
      stripeCheckoutSessionId: session.id,
    },
  });

  return session;
}

/**
 * Called from the Stripe webhook route on `checkout.session.completed`
 * for a coin-purchase session. Idempotent: a duplicate delivery of the
 * same event finds the CoinPurchase already COMPLETED and does nothing.
 * Never credits coins on the strength of anything except a verified
 * Stripe event reaching this function — the frontend redirecting to a
 * "success" URL is not itself proof of payment.
 */
export async function handleCoinPurchaseCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const purchase = await prisma.coinPurchase.findUnique({ where: { stripeCheckoutSessionId: session.id } });
  if (!purchase) {
    console.error(`[coins] checkout.session.completed for unknown session ${session.id} — ignoring.`);
    return;
  }
  if (purchase.status === "COMPLETED") return; // already credited — duplicate webhook delivery

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  try {
    await prisma.$transaction(async (tx) => {
      await recordWalletTransaction(tx, {
        userId: purchase.userId,
        type: "COIN_PURCHASE",
        amount: purchase.coinsCredited,
        referenceType: "CoinPurchase",
        referenceId: purchase.id,
        idempotencyKey: `coin-purchase:${purchase.id}`,
        metadata: { stripeCheckoutSessionId: session.id },
      });
      await tx.coinPurchase.update({
        where: { id: purchase.id },
        data: { status: "COMPLETED", completedAt: new Date(), stripePaymentIntentId: paymentIntentId },
      });
    });
  } catch (error) {
    // A concurrent/replayed delivery of the same event can lose the race
    // on the idempotency key — that's success, not failure, so swallow it.
    if (isUniqueConstraintViolation(error, "idempotencyKey")) return;
    throw error;
  }
}

/**
 * Called on a Stripe `charge.refunded` event for a coin purchase's
 * payment intent. Reverses the original COIN_PURCHASE wallet credit —
 * never deletes it — and marks the purchase REFUNDED. If the viewer
 * already spent some or all of those coins, the wallet can go negative
 * here; that's intentional (the debt is real and visible) rather than
 * silently capping it at zero, which would understate what happened.
 */
export async function handleCoinPurchaseRefunded(paymentIntentId: string): Promise<void> {
  const purchase = await prisma.coinPurchase.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!purchase) {
    console.error(`[coins] charge.refunded for unknown payment_intent ${paymentIntentId} — ignoring.`);
    return;
  }
  if (purchase.status === "REFUNDED") return; // already reversed — duplicate webhook delivery
  if (purchase.status !== "COMPLETED") {
    console.error(`[coins] charge.refunded for purchase ${purchase.id} that was never COMPLETED (status=${purchase.status}) — ignoring.`);
    return;
  }

  const originalTransaction = await prisma.walletTransaction.findUnique({ where: { idempotencyKey: `coin-purchase:${purchase.id}` } });
  if (!originalTransaction) {
    console.error(`[coins] charge.refunded for purchase ${purchase.id} but its original ledger row is missing — cannot reverse safely, needs manual review.`);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await recordWalletTransaction(tx, {
        userId: purchase.userId,
        type: "REFUND",
        amount: -purchase.coinsCredited,
        referenceType: "CoinPurchase",
        referenceId: purchase.id,
        reversesId: originalTransaction.id,
        idempotencyKey: `coin-purchase-refund:${purchase.id}`,
      });
      await tx.coinPurchase.update({ where: { id: purchase.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
      await tx.refund.create({
        data: { coinPurchaseId: purchase.id, coinsReversed: purchase.coinsCredited, status: "COMPLETED", completedAt: new Date() },
      });
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "idempotencyKey")) return;
    throw error;
  }
}
