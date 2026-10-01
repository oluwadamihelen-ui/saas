import "server-only";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getPaymentProvider, getProviderByName } from "@/lib/payments";
import { getMarketSettings } from "./settings";
import { splitSale } from "./fees";
import { isLicenseActive, majorOf, nextPeriodEnd } from "./licensing";
import { assertAdmin, audit, type Actor } from "./admin-core";
import { isPubliclyViewable } from "./listings";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

const TV_USERNAME = /^[A-Za-z0-9_]{3,30}$/;

export type PurchaseOutcome = { kind: "granted" } | { kind: "checkout"; url: string };

/**
 * Starts a purchase. FREE products are granted immediately; paid ones create a PENDING order with the
 * fee split snapshotted at today's settings, then hand off to the payment provider.
 */
export async function startPurchase(a: { buyerId: string; buyerEmail: string; listingId: string; currency: "USD" | "NGN"; tradingViewUsername?: string; appUrl: string }): Promise<Result<PurchaseOutcome>> {
  const l = await prisma.listing.findUnique({ where: { id: a.listingId }, include: { indicator: { select: { visibility: true, latestVersion: true } }, creator: { select: { id: true, userId: true, status: true } } } });
  if (!l || !isPubliclyViewable(l)) return fail("This product isn't available.");
  if (l.creator.userId === a.buyerId) return fail("You can't buy your own product.");
  let tv: string | null = null;
  if (l.tradingViewAccess && a.tradingViewUsername?.trim()) {
    if (!TV_USERNAME.test(a.tradingViewUsername.trim())) return fail("TradingView username can only contain letters, numbers and underscores.");
    tv = a.tradingViewUsername.trim();
  }
  const now = new Date();
  const existing = await prisma.license.findUnique({ where: { userId_listingId: { userId: a.buyerId, listingId: l.id } } });
  const active = existing ? isLicenseActive(existing, now) : false;

  if (l.pricingModel === "FREE") {
    await prisma.license.upsert({
      where: { userId_listingId: { userId: a.buyerId, listingId: l.id } },
      create: { userId: a.buyerId, listingId: l.id, status: "ACTIVE", type: "FREE", maxMajor: majorOf(l.indicator.latestVersion), tradingViewUsername: tv },
      update: active ? { tradingViewUsername: tv ?? existing?.tradingViewUsername } : { status: "ACTIVE", type: "FREE", startedAt: now, maxMajor: majorOf(l.indicator.latestVersion), tradingViewUsername: tv },
    });
    return { ok: true, kind: "granted" };
  }

  if (active && (l.pricingModel === "ONE_TIME" || (existing?.currentPeriodEnd && existing.currentPeriodEnd.getTime() - now.getTime() > 7 * 86_400_000))) {
    return fail(l.pricingModel === "ONE_TIME" ? "You already own this product." : "Your subscription is active. You can renew during the last 7 days.");
  }

  const settings = await getMarketSettings();
  const provider = getPaymentProvider();
  const currency = a.currency === "NGN" && provider.currencies.includes("NGN") ? "NGN" : "USD";
  const chargeMinor = currency === "NGN" ? Math.round(l.priceUsdCents * settings.ngnPerUsd) : l.priceUsdCents;
  const split = splitSale({ grossCents: l.priceUsdCents, commissionPercent: settings.commissionPercent, processingFeePercent: settings.processingFeePercent, processingFeeFixedCents: settings.processingFeeFixedCents, taxPercent: settings.taxPercent, feeBearer: settings.feeBearer });
  const reference = `mp_${randomUUID().replace(/-/g, "")}`;
  await prisma.marketOrder.create({
    data: {
      buyerId: a.buyerId, listingId: l.id, creatorId: l.creator.id, reference, provider: provider.name, status: "PENDING", pricingModel: l.pricingModel, currency, chargeMinor,
      usdPerMinor: currency === "NGN" ? 1 / settings.ngnPerUsd : 1, tradingViewUsername: tv,
      grossUsdCents: split.grossCents, taxUsdCents: split.taxCents, processingFeeUsdCents: split.processingFeeCents, commissionPercent: settings.commissionPercent,
      platformFeeUsdCents: split.commissionCents, creatorEarningUsdCents: split.creatorCents, feeBearer: settings.feeBearer,
    },
  });
  const session = await provider.createCheckout({ reference, amount: chargeMinor / 100, currency, email: a.buyerEmail, callbackUrl: `${a.appUrl}/market/callback?reference=${reference}` });
  return { ok: true, kind: "checkout", url: session.url };
}

/**
 * Marks the order paid and grants/extends the license + books the creator's earning — exactly once.
 * The PENDING→PAID flip is an atomic claim, so concurrent webhooks/callbacks cannot double-grant or double-book.
 */
export async function fulfillOrder(orderId: string) {
  const settings = await getMarketSettings();
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const claim = await tx.marketOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID", paidAt: now } });
    const order = await tx.marketOrder.findUniqueOrThrow({ where: { id: orderId }, include: { listing: { select: { indicator: { select: { latestVersion: true } } } } } });
    if (claim.count === 0) return order;
    const existing = await tx.license.findUnique({ where: { userId_listingId: { userId: order.buyerId, listingId: order.listingId } } });
    const type = order.pricingModel;
    const periodEnd = type === "MONTHLY" || type === "YEARLY" ? nextPeriodEnd(type, existing && existing.status === "ACTIVE" ? existing.currentPeriodEnd : null, now) : null;
    const restart = !existing || existing.status !== "ACTIVE";
    await tx.license.upsert({
      where: { userId_listingId: { userId: order.buyerId, listingId: order.listingId } },
      create: { userId: order.buyerId, listingId: order.listingId, orderId: order.id, status: "ACTIVE", type, startedAt: now, currentPeriodEnd: periodEnd, maxMajor: majorOf(order.listing.indicator.latestVersion), tradingViewUsername: order.tradingViewUsername },
      update: { status: "ACTIVE", type, orderId: order.id, currentPeriodEnd: periodEnd, tradingViewUsername: order.tradingViewUsername ?? existing?.tradingViewUsername ?? null, ...(restart ? { startedAt: now, maxMajor: majorOf(order.listing.indicator.latestVersion) } : {}) },
    });
    await tx.ledgerEntry.create({
      data: { creatorId: order.creatorId, orderId: order.id, kind: "SALE", amountUsdCents: order.creatorEarningUsdCents, availableAt: new Date(now.getTime() + settings.holdbackDays * 86_400_000), note: `Sale ${order.reference}` },
    });
    return order;
  });
}

/** Called by the checkout callback and the Paystack webhook. Verifies amount/currency against OUR order. */
export async function fulfillVerified(reference: string, paid: { amountMinor: number; currency: string }) {
  const order = await prisma.marketOrder.findUnique({ where: { reference } });
  if (!order || order.status !== "PENDING") return order;
  if (order.chargeMinor !== paid.amountMinor || order.currency !== paid.currency) return order; // mismatch → leave pending for review
  return fulfillOrder(order.id);
}

/**
 * Admin refund: calls the payment provider FIRST (a declined refund changes nothing), then atomically
 * flips PAID→REFUNDED, revokes the license and books a negative ledger entry for the creator's earning.
 */
export async function refundOrder(actor: Actor, orderId: string, reason: string): Promise<Result<object>> {
  assertAdmin(actor);
  const order = await prisma.marketOrder.findUnique({ where: { id: orderId } });
  if (!order) return fail("Order not found.");
  if (order.status !== "PAID") return fail("Only paid orders can be refunded.");
  const provider = getProviderByName(order.provider);
  if (provider.refund) {
    const r = await provider.refund(order.reference, order.chargeMinor);
    if (!r.ok) return fail(`The payment provider declined the refund: ${r.error ?? "unknown error"}`);
  }
  const done = await prisma.$transaction(async (tx) => {
    const claim = await tx.marketOrder.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "REFUNDED", refundedAt: new Date(), refundReason: reason.slice(0, 500) } });
    if (claim.count === 0) return false;
    await tx.license.updateMany({ where: { orderId, userId: order.buyerId, listingId: order.listingId }, data: { status: "REFUNDED" } });
    // Book the reversal in the SAME maturity bucket as the sale, so a refund inside the holdback cancels the
    // pending balance instead of leaving a phantom amount; a refund after maturity reduces available funds.
    const sale = await tx.ledgerEntry.findUnique({ where: { orderId_kind: { orderId, kind: "SALE" } } });
    await tx.ledgerEntry.create({ data: { creatorId: order.creatorId, orderId, kind: "REFUND", amountUsdCents: -order.creatorEarningUsdCents, availableAt: sale?.availableAt ?? new Date(), note: `Refund ${order.reference}` } });
    return true;
  });
  if (!done) return fail("This order was already refunded.");
  await audit(actor, "ORDER_REFUND", "order", orderId, { reason, amountUsdCents: order.grossUsdCents });
  return { ok: true };
}

export async function setTradingViewUsername(userId: string, listingId: string, username: string): Promise<Result<object>> {
  if (!TV_USERNAME.test(username.trim())) return fail("TradingView username can only contain letters, numbers and underscores.");
  const r = await prisma.license.updateMany({ where: { userId, listingId, status: "ACTIVE" }, data: { tradingViewUsername: username.trim(), accessGrantedAt: null } });
  return r.count ? { ok: true } : fail("You don't have an active license for this product.");
}

/** Creator confirms they granted invite-only TradingView access to this buyer. */
export async function markTradingViewGranted(creatorUserId: string, licenseId: string): Promise<Result<object>> {
  const r = await prisma.license.updateMany({ where: { id: licenseId, listing: { creator: { userId: creatorUserId } } }, data: { accessGrantedAt: new Date() } });
  return r.count ? { ok: true } : fail("License not found.");
}
