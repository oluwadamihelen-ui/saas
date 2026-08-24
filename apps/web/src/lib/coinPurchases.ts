import { createPaystackClient, createKorapayClient, verifyKorapayWebhookSignature, type KorapayWebhookEvent, type KorapayChargeEventData, type KorapayRefundEventData } from "@cinerra/billing";
import type { PaymentProvider } from "@cinerra/database";
import { prisma } from "./db";
import { env } from "./env";
import { recordWalletTransaction, isUniqueConstraintViolation } from "./wallet";

export class PaymentsNotConfiguredError extends Error {
  constructor(provider: PaymentProvider) {
    super(`Buying coins with ${provider === "PAYSTACK" ? "Paystack" : "Korapay"} isn't available yet — it isn't configured on this server.`);
  }
}
export class CoinPackageUnavailableError extends Error {
  constructor() {
    super("That coin package isn't available.");
  }
}
export class KorapayNotConfiguredError extends Error {
  constructor() {
    super("Korapay isn't configured on this server.");
  }
}
export class InvalidKorapayWebhookSignatureError extends Error {
  constructor() {
    super("Invalid webhook signature.");
  }
}

export async function createCoinPurchaseCheckout(params: { userId: string; coinPackageId: string; provider: PaymentProvider }): Promise<{ url: string }> {
  const [user, coinPackage] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: params.userId } }),
    prisma.coinPackage.findUnique({ where: { id: params.coinPackageId } }),
  ]);
  if (!coinPackage || !coinPackage.active) throw new CoinPackageUnavailableError();

  const totalCoins = coinPackage.coins + coinPackage.bonusCoins;
  // Generated here (not by the provider) so it can double as this
  // purchase's idempotency key — both Paystack and Korapay accept a
  // caller-supplied reference and echo it back verbatim on every webhook
  // for the resulting charge.
  const reference = `coin:${params.userId}:${coinPackage.id}:${Date.now()}`;

  let url: string;
  if (params.provider === "PAYSTACK") {
    if (!env.PAYSTACK_SECRET_KEY) throw new PaymentsNotConfiguredError("PAYSTACK");
    const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY);
    const result = await paystack.initializeTransaction({
      email: user.email,
      amount: coinPackage.priceCents, // Paystack wants the minor unit (kobo)
      reference,
      callbackUrl: `${env.APP_BASE_URL}/wallet?checkout=success`,
      metadata: { type: "coin_purchase", userId: params.userId, coinPackageId: coinPackage.id },
    });
    url = result.authorization_url;
  } else {
    if (!env.KORAPAY_SECRET_KEY) throw new PaymentsNotConfiguredError("KORAPAY");
    const korapay = createKorapayClient(env.KORAPAY_SECRET_KEY);
    // Korapay wants the MAJOR currency unit (naira, not kobo) — the
    // opposite convention from Paystack. priceCents is stored in the minor
    // unit throughout this codebase (the same "cents" field Stripe's
    // unit_amount used directly), so this is a real, deliberate conversion,
    // not a rounding accident: get it wrong and Korapay charges 100x.
    const majorAmount = coinPackage.priceCents / 100;
    const result = await korapay.initializeCharge({
      amount: majorAmount,
      currency: coinPackage.currency,
      reference,
      customerEmail: user.email,
      redirectUrl: `${env.APP_BASE_URL}/wallet?checkout=success`,
      notificationUrl: `${env.APP_BASE_URL}/api/webhooks/korapay`,
    });
    url = result.checkout_url;
  }

  // The PENDING row is created now, before the webhook — its unique
  // providerReference is what makes crediting idempotent: the webhook only
  // ever transitions this exact row from PENDING to COMPLETED, and a
  // replayed event finds it already COMPLETED and no-ops.
  await prisma.coinPurchase.create({
    data: {
      userId: params.userId,
      coinPackageId: coinPackage.id,
      coinsCredited: totalCoins,
      amountCents: coinPackage.priceCents,
      currency: coinPackage.currency,
      status: "PENDING",
      provider: params.provider,
      providerReference: reference,
    },
  });

  return { url };
}

/**
 * Called from the Paystack/Korapay webhook routes on a successful charge —
 * looked up by the reference we generated at checkout, never trusts
 * anything else the provider echoes back. Idempotent: a duplicate delivery
 * of the same event finds the CoinPurchase already COMPLETED and does
 * nothing. Never credits coins on the strength of anything except a
 * verified webhook reaching this function — the frontend redirecting to a
 * "success" URL is not itself proof of payment.
 */
export async function handleCoinPurchaseCompleted(params: { reference: string; providerTransactionId?: string }): Promise<void> {
  const purchase = await prisma.coinPurchase.findUnique({ where: { providerReference: params.reference } });
  if (!purchase) {
    console.error(`[coins] charge success for unknown reference ${params.reference} — ignoring.`);
    return;
  }
  if (purchase.status === "COMPLETED") return; // already credited — duplicate webhook delivery

  try {
    await prisma.$transaction(async (tx) => {
      await recordWalletTransaction(tx, {
        userId: purchase.userId,
        type: "COIN_PURCHASE",
        amount: purchase.coinsCredited,
        referenceType: "CoinPurchase",
        referenceId: purchase.id,
        idempotencyKey: `coin-purchase:${purchase.id}`,
        metadata: { provider: purchase.provider, providerReference: params.reference },
      });
      await tx.coinPurchase.update({
        where: { id: purchase.id },
        data: { status: "COMPLETED", completedAt: new Date(), providerTransactionId: params.providerTransactionId },
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
 * Called on a Paystack `refund.processed` or Korapay `refund.success`
 * event for a coin purchase's original charge reference. Reverses the
 * original COIN_PURCHASE wallet credit — never deletes it — and marks the
 * purchase REFUNDED. If the viewer already spent some or all of those
 * coins, the wallet can go negative here; that's intentional (the debt is
 * real and visible) rather than silently capping it at zero, which would
 * understate what happened.
 */
export async function handleCoinPurchaseRefunded(reference: string): Promise<void> {
  const purchase = await prisma.coinPurchase.findUnique({ where: { providerReference: reference } });
  if (!purchase) {
    console.error(`[coins] refund event for unknown reference ${reference} — ignoring.`);
    return;
  }
  if (purchase.status === "REFUNDED") return; // already reversed — duplicate webhook delivery
  if (purchase.status !== "COMPLETED") {
    console.error(`[coins] refund event for purchase ${purchase.id} that was never COMPLETED (status=${purchase.status}) — ignoring.`);
    return;
  }

  const originalTransaction = await prisma.walletTransaction.findUnique({ where: { idempotencyKey: `coin-purchase:${purchase.id}` } });
  if (!originalTransaction) {
    console.error(`[coins] refund event for purchase ${purchase.id} but its original ledger row is missing — cannot reverse safely, needs manual review.`);
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

/**
 * The single Korapay webhook entry point. Korapay signs only the `data`
 * object (HMAC-SHA256), not the whole envelope — confirmed against
 * Korapay's own published verification example — so the signature check
 * re-serializes just that sub-object rather than the raw body.
 */
export async function handleKorapayWebhookEvent(rawBody: string, signature: string | null): Promise<void> {
  if (!env.KORAPAY_SECRET_KEY) throw new KorapayNotConfiguredError();

  const event = JSON.parse(rawBody) as KorapayWebhookEvent;
  const dataJson = JSON.stringify(event.data);
  if (!signature || !verifyKorapayWebhookSignature(dataJson, signature, env.KORAPAY_SECRET_KEY)) {
    throw new InvalidKorapayWebhookSignatureError();
  }

  if (event.event === "charge.success") {
    const data = event.data as KorapayChargeEventData;
    await handleCoinPurchaseCompleted({ reference: data.reference });
    return;
  }
  if (event.event === "refund.success") {
    const data = event.data as KorapayRefundEventData;
    await handleCoinPurchaseRefunded(data.payment_reference);
    return;
  }
}
