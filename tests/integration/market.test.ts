import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { fulfillOrder, fulfillVerified, refundOrder, startPurchase, setTradingViewUsername } from "@/lib/market/orders";
import { getListingPage, searchListings, updateListing, submitForReview, attachEvidence, submissionProblems } from "@/lib/market/listings";
import { entitledVersions, getSourceForUser, getSourceForAdminReview } from "@/lib/market/access";
import { submitReview, setReviewStatus, reportContent } from "@/lib/market/reviews";
import { reviewListing, setCreatorVerified, processPayout, resolveReport } from "@/lib/market/admin";
import { creatorBalances, requestPayout, setPayoutMethod, payoutStatusOf, creatorOverview } from "@/lib/market/creator";
import { getMarketSettings, saveMarketSettings, invalidateSettingsCache } from "@/lib/market/settings";
import { splitSale } from "@/lib/market/fees";
import { Forbidden } from "@/lib/market/admin-core";
import { cleanup, hasDb, makeUser } from "./helpers";
import { SECRET, adminUser, baseListing, makeEvidenceRun, makeListing } from "./market-helpers";

const users: string[] = [];
const track = <T extends { id: string }>(u: T) => (users.push(u.id), u);
afterAll(async () => { await cleanup(users); });
beforeEach(() => { process.env.PAYMENT_PROVIDER = "mock"; delete process.env.MOCK_REFUND_FAIL; invalidateSettingsCache(); });

const APP = "http://localhost:3000";
async function buy(buyerId: string, listingId: string, currency: "USD" | "NGN" = "USD", tv?: string) {
  const r = await startPurchase({ buyerId, buyerEmail: "b@x.test", listingId, currency, tradingViewUsername: tv, appUrl: APP });
  if (!r.ok) throw new Error(r.error);
  return r;
}
async function buyAndPay(buyerId: string, listingId: string) {
  const r = await buy(buyerId, listingId);
  if (r.kind !== "checkout") return null;
  const order = await prisma.marketOrder.findFirstOrThrow({ where: { buyerId, listingId }, orderBy: { createdAt: "desc" } });
  await fulfillOrder(order.id);
  return prisma.marketOrder.findUniqueOrThrow({ where: { id: order.id } });
}

describe.skipIf(!hasDb)("source code privacy", () => {
  it("never appears in public pages, search, or entitled-version metadata", async () => {
    const { listing, user: creator } = await makeListing(); track(creator);
    const buyer = track(await makeUser());
    await buyAndPay(buyer.id, listing.id);
    const anon = await getListingPage(listing.slug, null);
    const asBuyer = await getListingPage(listing.slug, { id: buyer.id, role: "USER" });
    const asOwner = await getListingPage(listing.slug, { id: creator.id, role: "USER" });
    const search = await searchListings({ q: "Gold Sniper" });
    for (const payload of [anon, asBuyer, asOwner, search, await entitledVersions(buyer.id, listing.id)]) {
      expect(JSON.stringify(payload)).not.toContain(SECRET);
      expect(JSON.stringify(payload)).not.toMatch(/"code"|"source"/);
    }
    expect(anon?.indicator.versions[0].version).toBe("1.0"); // metadata IS public
  });

  it("protected by default: buyers get access, not the source", async () => {
    const { listing, user: creator } = await makeListing(); track(creator);
    const buyer = track(await makeUser());
    const stranger = track(await makeUser());
    await buyAndPay(buyer.id, listing.id);
    expect(await getSourceForUser(null, listing.id)).toMatchObject({ ok: false, status: 401 });
    expect(await getSourceForUser(stranger.id, listing.id)).toMatchObject({ ok: false, status: 403 });
    const b = await getSourceForUser(buyer.id, listing.id);
    expect(b).toMatchObject({ ok: false, status: 403 });
    expect(JSON.stringify(b)).not.toContain(SECRET);
    const o = await getSourceForUser(creator.id, listing.id);
    expect(o.ok && o.code).toContain(SECRET);
  });

  it("source-included products give it only to active licensees, and stop on refund / expiry / revoke", async () => {
    const { listing, user: creator } = await makeListing({ sourceIncluded: true }); track(creator);
    const buyer = track(await makeUser());
    const stranger = track(await makeUser());
    const order = await buyAndPay(buyer.id, listing.id);
    const ok = await getSourceForUser(buyer.id, listing.id);
    expect(ok.ok && ok.code).toContain(SECRET);
    expect((await getSourceForUser(stranger.id, listing.id)).ok).toBe(false);
    // expiry
    await prisma.license.update({ where: { userId_listingId: { userId: buyer.id, listingId: listing.id } }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    expect(await getSourceForUser(buyer.id, listing.id)).toMatchObject({ ok: false, status: 403 });
    await prisma.license.update({ where: { userId_listingId: { userId: buyer.id, listingId: listing.id } }, data: { currentPeriodEnd: new Date(Date.now() + 86_400_000) } });
    expect((await getSourceForUser(buyer.id, listing.id)).ok).toBe(true);
    // refund revokes
    const admin = await adminUser(); track({ id: admin.id });
    expect((await refundOrder(admin, order!.id, "test refund")).ok).toBe(true);
    expect(await getSourceForUser(buyer.id, listing.id)).toMatchObject({ ok: false, status: 403 });
    // suspended listing
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "SUSPENDED" } });
    expect((await getSourceForUser(creator.id, listing.id)).ok).toBe(true); // creator still owns it
  });

  it("only admins can read source for review, and every read is audited", async () => {
    const { listing, user: creator } = await makeListing(); track(creator);
    const nobody = track(await makeUser());
    await expect(getSourceForAdminReview({ id: nobody.id, role: "USER" }, listing.id)).rejects.toBeInstanceOf(Forbidden);
    const admin = await adminUser(); track({ id: admin.id });
    const s = await getSourceForAdminReview(admin, listing.id);
    expect(s?.code).toContain(SECRET);
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, action: "VIEW_SOURCE", targetId: listing.id } })).toBe(1);
  });
});

describe.skipIf(!hasDb)("visibility", () => {
  it("private is hidden; unlisted is reachable by link but not searchable; public is both", async () => {
    const pub = await makeListing({ visibility: "PUBLIC" }); track(pub.user);
    const unl = await makeListing({ visibility: "UNLISTED" }); track(unl.user);
    const priv = await makeListing({ visibility: "PRIVATE" }); track(priv.user);
    const stranger = { id: track(await makeUser()).id, role: "USER" as const };
    expect(await getListingPage(pub.listing.slug, null)).not.toBeNull();
    expect(await getListingPage(unl.listing.slug, null)).not.toBeNull();
    expect(await getListingPage(priv.listing.slug, null)).toBeNull();
    expect(await getListingPage(priv.listing.slug, stranger)).toBeNull();
    expect(await getListingPage(priv.listing.slug, { id: priv.user.id, role: "USER" })).not.toBeNull();
    const ids = (await searchListings({})).map((r) => r.id);
    expect(ids).toContain(pub.listing.id);
    expect(ids).not.toContain(unl.listing.id);
    expect(ids).not.toContain(priv.listing.id);
  });
  it("drafts, pending, rejected and suspended listings are not public (admins and owners still see them)", async () => {
    const admin = await adminUser(); track({ id: admin.id });
    for (const status of ["DRAFT", "PENDING_REVIEW", "REJECTED", "SUSPENDED"] as const) {
      const l = await makeListing({ approve: false }); track(l.user);
      await prisma.listing.update({ where: { id: l.listing.id }, data: { status } });
      expect(await getListingPage(l.listing.slug, null)).toBeNull();
      expect(await getListingPage(l.listing.slug, { id: l.user.id, role: "USER" })).not.toBeNull();
      expect(await getListingPage(l.listing.slug, admin)).not.toBeNull();
      expect((await searchListings({})).map((r) => r.id)).not.toContain(l.listing.id);
    }
  });
  it("a suspended creator's products disappear", async () => {
    const l = await makeListing(); track(l.user);
    await prisma.creator.update({ where: { id: l.creatorId }, data: { status: "SUSPENDED" } });
    expect(await getListingPage(l.listing.slug, null)).toBeNull();
    const r = await startPurchase({ buyerId: track(await makeUser()).id, buyerEmail: "x@y.z", listingId: l.listing.id, currency: "USD", appUrl: APP });
    expect(r.ok).toBe(false);
  });
});

describe.skipIf(!hasDb)("search & filters", () => {
  it("filters by market, timeframe, category, price and text", async () => {
    const l = await makeListing({ pricing: "ONE_TIME", price: 49 }); track(l.user);
    const free = await makeListing({ pricing: "FREE" }); track(free.user);
    const has = async (p: Parameters<typeof searchListings>[0], id: string) => (await searchListings(p)).some((r) => r.id === id);
    expect(await has({ market: "XAUUSD" }, l.listing.id)).toBe(true);
    expect(await has({ market: "BTCUSD" }, l.listing.id)).toBe(false);
    expect(await has({ timeframe: "H4" }, l.listing.id)).toBe(true);
    expect(await has({ timeframe: "M5" }, l.listing.id)).toBe(false);
    expect(await has({ category: "gold" }, l.listing.id)).toBe(true);
    expect(await has({ category: "forex" }, l.listing.id)).toBe(false);
    expect(await has({ price: "free" }, free.listing.id)).toBe(true);
    expect(await has({ price: "free" }, l.listing.id)).toBe(false);
    expect(await has({ price: "paid" }, l.listing.id)).toBe(true);
    expect(await has({ maxPrice: 20 }, l.listing.id)).toBe(false);
    expect(await has({ q: "gold sniper" }, l.listing.id)).toBe(true);
    expect(await has({ q: "Test Creator" }, l.listing.id)).toBe(true);
    expect(await has({ q: "zzzz-nothing" }, l.listing.id)).toBe(false);
  });
});

describe.skipIf(!hasDb)("purchase, fulfilment and the ledger", () => {
  it("free products are granted instantly with no order", async () => {
    const l = await makeListing({ pricing: "FREE" }); track(l.user);
    const b = track(await makeUser());
    expect((await buy(b.id, l.listing.id)).kind).toBe("granted");
    expect(await prisma.marketOrder.count({ where: { buyerId: b.id } })).toBe(0);
    expect((await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } })).type).toBe("FREE");
  });

  it("snapshots the fee split from the current settings, and pays the creator via a held ledger entry", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    const s = await getMarketSettings();
    const order = await buyAndPay(b.id, l.listing.id);
    const split = splitSale({ grossCents: 1900, commissionPercent: s.commissionPercent, processingFeePercent: s.processingFeePercent, processingFeeFixedCents: s.processingFeeFixedCents, taxPercent: s.taxPercent, feeBearer: s.feeBearer });
    expect(order).toMatchObject({ status: "PAID", grossUsdCents: 1900, platformFeeUsdCents: split.commissionCents, creatorEarningUsdCents: split.creatorCents, commissionPercent: s.commissionPercent });
    const bal = await creatorBalances(l.creatorId);
    expect(bal.totalEarningsCents).toBe(split.creatorCents);
    expect(bal.pendingCents).toBe(split.creatorCents); // inside the holdback
    expect(bal.availableCents).toBe(0);
    const lic = await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } });
    expect(lic.status).toBe("ACTIVE");
    expect(lic.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 30 * 86_400_000);
  });

  it("NGN checkout charges at the configured rate but books creator money in USD", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    await buy(b.id, l.listing.id, "NGN");
    const o = await prisma.marketOrder.findFirstOrThrow({ where: { buyerId: b.id } });
    const s = await getMarketSettings();
    expect(o.currency).toBe("NGN");
    expect(o.chargeMinor).toBe(Math.round(1900 * s.ngnPerUsd));
    expect(o.grossUsdCents).toBe(1900);
  });

  it("is idempotent and safe under concurrent fulfilment (one license grant, one ledger row)", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    await buy(b.id, l.listing.id);
    const order = await prisma.marketOrder.findFirstOrThrow({ where: { buyerId: b.id } });
    await Promise.all([1, 2, 3, 4, 5].map(() => fulfillOrder(order.id)));
    await fulfillOrder(order.id);
    expect(await prisma.ledgerEntry.count({ where: { orderId: order.id } })).toBe(1);
    const lic = await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } });
    expect(Math.round((lic.currentPeriodEnd!.getTime() - Date.now()) / 86_400_000)).toBe(31); // one period, not five
  });

  it("does not fulfil when the paid amount or currency doesn't match our order", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    await buy(b.id, l.listing.id);
    const o = await prisma.marketOrder.findFirstOrThrow({ where: { buyerId: b.id } });
    await fulfillVerified(o.reference, { amountMinor: 100, currency: "USD" });
    await fulfillVerified(o.reference, { amountMinor: o.chargeMinor, currency: "NGN" });
    expect((await prisma.marketOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING");
    expect(await prisma.license.count({ where: { userId: b.id, listingId: l.listing.id } })).toBe(0);
    await fulfillVerified(o.reference, { amountMinor: o.chargeMinor, currency: o.currency });
    expect((await prisma.marketOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
  });

  it("blocks buying your own product, duplicate one-time purchases, and early subscription renewals — but allows renewal in the last 7 days", async () => {
    const own = await makeListing({ price: 19 }); track(own.user);
    expect((await startPurchase({ buyerId: own.user.id, buyerEmail: "a@b.c", listingId: own.listing.id, currency: "USD", appUrl: APP })).ok).toBe(false);
    const one = await makeListing({ pricing: "ONE_TIME", price: 49 }); track(one.user);
    const b = track(await makeUser());
    await buyAndPay(b.id, one.listing.id);
    expect((await startPurchase({ buyerId: b.id, buyerEmail: "a@b.c", listingId: one.listing.id, currency: "USD", appUrl: APP })).ok).toBe(false);
    await buyAndPay(b.id, own.listing.id);
    expect((await startPurchase({ buyerId: b.id, buyerEmail: "a@b.c", listingId: own.listing.id, currency: "USD", appUrl: APP })).ok).toBe(false);
    await prisma.license.update({ where: { userId_listingId: { userId: b.id, listingId: own.listing.id } }, data: { currentPeriodEnd: new Date(Date.now() + 3 * 86_400_000) } });
    expect((await startPurchase({ buyerId: b.id, buyerEmail: "a@b.c", listingId: own.listing.id, currency: "USD", appUrl: APP })).ok).toBe(true);
  });

  it("renewal extends from the current end date", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    await buyAndPay(b.id, l.listing.id);
    const end = new Date(Date.now() + 3 * 86_400_000);
    await prisma.license.update({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } }, data: { currentPeriodEnd: end } });
    await buyAndPay(b.id, l.listing.id);
    const lic = await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } });
    expect(lic.currentPeriodEnd!.getTime()).toBe(end.getTime() + 31 * 86_400_000);
  });

  it("validates TradingView usernames and records them for the creator", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    await prisma.listing.update({ where: { id: l.listing.id }, data: { tradingViewAccess: true } });
    const b = track(await makeUser());
    expect((await startPurchase({ buyerId: b.id, buyerEmail: "a@b.c", listingId: l.listing.id, currency: "USD", tradingViewUsername: "bad name!", appUrl: APP })).ok).toBe(false);
    await buy(b.id, l.listing.id, "USD", "good_name1");
    const o = await prisma.marketOrder.findFirstOrThrow({ where: { buyerId: b.id } });
    await fulfillOrder(o.id);
    expect((await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } })).tradingViewUsername).toBe("good_name1");
    expect((await setTradingViewUsername(b.id, l.listing.id, "x")).ok).toBe(false);
    expect((await setTradingViewUsername(track(await makeUser()).id, l.listing.id, "valid_name")).ok).toBe(false);
  });
});

describe.skipIf(!hasDb)("refunds", () => {
  it("only admins can refund", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    const o = await buyAndPay(b.id, l.listing.id);
    await expect(refundOrder({ id: b.id, role: "USER" }, o!.id, "pls")).rejects.toBeInstanceOf(Forbidden);
    await expect(refundOrder({ id: l.user.id, role: "USER" }, o!.id, "pls")).rejects.toBeInstanceOf(Forbidden);
    expect((await prisma.marketOrder.findUniqueOrThrow({ where: { id: o!.id } })).status).toBe("PAID");
  });
  it("reverses the creator's earning, revokes the license and cannot be repeated", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    const admin = await adminUser(); track({ id: admin.id });
    const o = await buyAndPay(b.id, l.listing.id);
    expect((await refundOrder(admin, o!.id, "customer request")).ok).toBe(true);
    expect((await refundOrder(admin, o!.id, "again")).ok).toBe(false);
    expect((await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } })).status).toBe("REFUNDED");
    const bal = await creatorBalances(l.creatorId);
    expect(bal.totalEarningsCents).toBe(0);
    expect(bal.pendingCents).toBe(0);
    expect(await prisma.ledgerEntry.count({ where: { orderId: o!.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "ORDER_REFUND", targetId: o!.id } })).toBe(1);
  });
  it("leaves everything untouched when the payment provider declines the refund", async () => {
    process.env.MOCK_REFUND_FAIL = "1";
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser());
    const admin = await adminUser(); track({ id: admin.id });
    const o = await buyAndPay(b.id, l.listing.id);
    const r = await refundOrder(admin, o!.id, "x");
    expect(r.ok).toBe(false);
    expect((await prisma.marketOrder.findUniqueOrThrow({ where: { id: o!.id } })).status).toBe("PAID");
    expect((await prisma.license.findUniqueOrThrow({ where: { userId_listingId: { userId: b.id, listingId: l.listing.id } } })).status).toBe("ACTIVE");
  });
});

describe.skipIf(!hasDb)("creator payouts", () => {
  async function creatorWithMaturedSale(priceUsd = 499) {
    const l = await makeListing({ price: priceUsd, pricing: "ONE_TIME" }); track(l.user);
    const b = track(await makeUser());
    // price limits default to $500 max for one-time, so 499 is valid
    await buyAndPay(b.id, l.listing.id);
    await prisma.ledgerEntry.updateMany({ where: { creatorId: l.creatorId }, data: { availableAt: new Date(Date.now() - 86_400_000) } });
    return l;
  }
  it("needs payout details AND admin verification, a minimum balance, and allows only one open request (even concurrently)", async () => {
    const l = await creatorWithMaturedSale();
    expect((await requestPayout(l.user.id)).ok).toBe(false); // no method
    expect((await setPayoutMethod(l.user.id, "x")).ok).toBe(false);
    expect((await setPayoutMethod(l.user.id, "GTBank 0123456789 Ada Obi")).ok).toBe(true);
    const c = await prisma.creator.findUniqueOrThrow({ where: { id: l.creatorId } });
    expect(c.payoutMethodEnc).not.toContain("GTBank"); // encrypted at rest
    expect(c.payoutMethodHint).toBe("••••6789");
    expect(payoutStatusOf(c)).toBe("PENDING_VERIFICATION");
    expect((await requestPayout(l.user.id)).ok).toBe(false); // not verified
    const admin = await adminUser(); track({ id: admin.id });
    await prisma.creator.update({ where: { id: l.creatorId }, data: { payoutVerifiedAt: new Date() } });
    const results = await Promise.all([requestPayout(l.user.id), requestPayout(l.user.id), requestPayout(l.user.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.payout.count({ where: { creatorId: l.creatorId } })).toBe(1);
    const bal = await creatorBalances(l.creatorId);
    expect(bal.availableCents).toBe(0);
    expect(bal.reservedCents).toBeGreaterThan(0);
    // admin pays it
    const p = await prisma.payout.findFirstOrThrow({ where: { creatorId: l.creatorId } });
    await expect(processPayout({ id: l.user.id, role: "USER" }, p.id, "PAID", "ref123")).rejects.toBeInstanceOf(Forbidden);
    expect((await processPayout(admin, p.id, "PAID", "")).ok).toBe(false); // reference required
    expect((await processPayout(admin, p.id, "PAID", "TRX-12345")).ok).toBe(true);
    expect((await processPayout(admin, p.id, "PAID", "TRX-12345")).ok).toBe(false);
    const after = await creatorBalances(l.creatorId);
    expect(after.totalPaidCents).toBe(p.amountUsdCents);
    expect(after.availableCents).toBe(0);
  });
  it("a failed payout releases the reserved money", async () => {
    const l = await creatorWithMaturedSale();
    await setPayoutMethod(l.user.id, "GTBank 0123456789 Ada Obi");
    await prisma.creator.update({ where: { id: l.creatorId }, data: { payoutVerifiedAt: new Date() } });
    await requestPayout(l.user.id);
    const admin = await adminUser(); track({ id: admin.id });
    const p = await prisma.payout.findFirstOrThrow({ where: { creatorId: l.creatorId } });
    await processPayout(admin, p.id, "FAILED", "bank rejected");
    const b = await creatorBalances(l.creatorId);
    expect(b.reservedCents).toBe(0);
    expect(b.availableCents).toBe(p.amountUsdCents);
  });
  it("below-minimum balances can't be paid out", async () => {
    const l = await makeListing({ price: 6, pricing: "ONE_TIME" }); track(l.user);
    const b = track(await makeUser());
    await buyAndPay(b.id, l.listing.id);
    await prisma.ledgerEntry.updateMany({ where: { creatorId: l.creatorId }, data: { availableAt: new Date(Date.now() - 1000) } });
    await setPayoutMethod(l.user.id, "GTBank 0123456789 Ada Obi");
    await prisma.creator.update({ where: { id: l.creatorId }, data: { payoutVerifiedAt: new Date() } });
    const r = await requestPayout(l.user.id);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/minimum payout/);
  });
  it("creator analytics reflect sales, refunds, subscribers and ratings", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b1 = track(await makeUser()), b2 = track(await makeUser());
    const admin = await adminUser(); track({ id: admin.id });
    await buyAndPay(b1.id, l.listing.id);
    const o2 = await buyAndPay(b2.id, l.listing.id);
    await refundOrder(admin, o2!.id, "x");
    await submitReview(b1.id, l.listing.id, { rating: 4, title: "ok", body: "fine" });
    const o = await creatorOverview(l.user.id);
    const row = o!.rows.find((r) => r.id === l.listing.id)!;
    expect(row.sales).toBe(2);
    expect(row.refunds).toBe(1);
    expect(row.refundRate).toBe(50);
    expect(row.subscribers).toBe(1);
    expect(row.rating).toEqual({ avg: 4, count: 1 });
    expect(o!.balances.totalEarningsCents).toBe(row.revenueCents);
    expect(o!.revenue.day).toHaveLength(14);
  });
});

describe.skipIf(!hasDb)("reviews", () => {
  it("creators can't review themselves; only licensees can; one review per user; refunded buyers can't", async () => {
    const l = await makeListing({ price: 19 }); track(l.user);
    const b = track(await makeUser()), stranger = track(await makeUser());
    const admin = await adminUser(); track({ id: admin.id });
    await buyAndPay(b.id, l.listing.id);
    expect((await submitReview(l.user.id, l.listing.id, { rating: 5, title: "", body: "mine" })).ok).toBe(false);
    expect((await submitReview(stranger.id, l.listing.id, { rating: 5, title: "", body: "x" })).ok).toBe(false);
    expect((await submitReview(b.id, l.listing.id, { rating: 0, title: "", body: "x" })).ok).toBe(false);
    expect((await submitReview(b.id, l.listing.id, { rating: 6, title: "", body: "x" })).ok).toBe(false);
    expect((await submitReview(b.id, l.listing.id, { rating: 3, title: "meh", body: "so-so" })).ok).toBe(true);
    expect((await submitReview(b.id, l.listing.id, { rating: 5, title: "better", body: "improved" })).ok).toBe(true);
    const rows = await prisma.review.findMany({ where: { listingId: l.listing.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: 5, verifiedPurchase: true });
    const o = await prisma.marketOrder.findFirstOrThrow({ where: { buyerId: b.id } });
    await refundOrder(admin, o.id, "x");
    expect((await submitReview(b.id, l.listing.id, { rating: 1, title: "", body: "angry" })).ok).toBe(false);
  });
  it("free users can review but are not shown as verified purchasers", async () => {
    const l = await makeListing({ pricing: "FREE" }); track(l.user);
    const b = track(await makeUser());
    await buy(b.id, l.listing.id);
    expect((await submitReview(b.id, l.listing.id, { rating: 4, title: "", body: "good" })).ok).toBe(true);
    expect((await prisma.review.findFirstOrThrow({ where: { userId: b.id } })).verifiedPurchase).toBe(false);
  });
  it("moderation: only admins hide reviews; hidden reviews leave the page and the average", async () => {
    const l = await makeListing({ pricing: "FREE" }); track(l.user);
    const b = track(await makeUser());
    await buy(b.id, l.listing.id);
    await submitReview(b.id, l.listing.id, { rating: 1, title: "x", body: "abusive text" });
    const rev = await prisma.review.findFirstOrThrow({ where: { userId: b.id } });
    await expect(setReviewStatus({ id: l.user.id, role: "USER" }, rev.id, "HIDDEN")).rejects.toBeInstanceOf(Forbidden);
    const admin = await adminUser(); track({ id: admin.id });
    expect((await getListingPage(l.listing.slug, null))!.reviews).toHaveLength(1);
    await setReviewStatus(admin, rev.id, "HIDDEN");
    const page = (await getListingPage(l.listing.slug, null))!;
    expect(page.reviews).toHaveLength(0);
    expect(page.rating.count).toBe(0);
  });
  it("reports go to a queue that only admins can resolve", async () => {
    const l = await makeListing(); track(l.user);
    const reporter = track(await makeUser());
    expect((await reportContent(reporter.id, { listingId: l.listing.id, reason: "Misleading claims", details: "..." })).ok).toBe(true);
    expect((await reportContent(reporter.id, { reason: "x", details: "" })).ok).toBe(false);
    const rep = await prisma.report.findFirstOrThrow({ where: { reporterId: reporter.id } });
    await expect(resolveReport({ id: reporter.id, role: "USER" }, rep.id, "SUSPEND_LISTING")).rejects.toBeInstanceOf(Forbidden);
    const admin = await adminUser(); track({ id: admin.id });
    expect((await resolveReport(admin, rep.id, "SUSPEND_LISTING", "Claims violate the rules")).ok).toBe(true);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.listing.id } })).status).toBe("SUSPENDED");
  });
});

describe.skipIf(!hasDb)("listing rules & moderation", () => {
  it("blocks forbidden claims in any marketing field", async () => {
    const l = await makeListing({ approve: false }); track(l.user);
    for (const field of ["title", "tagline", "description", "documentation", "methodology"] as const) {
      const r = await updateListing(l.user.id, l.listing.id, baseListing({ [field]: field === "title" ? "Guaranteed profits EA" : "This never loses and has a 90% win rate. ".repeat(4) }));
      expect(r.ok, field).toBe(false);
    }
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ features: ["100% accurate signals"] }))).ok).toBe(false);
  });
  it("enforces price limits from platform settings, the https video allow-list and valid categories", async () => {
    const l = await makeListing({ approve: false }); track(l.user);
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ priceUsd: 1 }))).ok).toBe(false);
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ priceUsd: 999999 }))).ok).toBe(false);
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ pricingModel: "FREE", priceUsd: 5 }))).ok).toBe(true); // FREE ignores price
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ demoVideoUrl: "http://youtube.com/watch?v=1" }))).ok).toBe(false);
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ demoVideoUrl: "https://evil.example/x" }))).ok).toBe(false);
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ demoVideoUrl: "https://youtu.be/abc" }))).ok).toBe(true);
    expect((await updateListing(l.user.id, l.listing.id, baseListing({ categories: ["nope"] }))).ok).toBe(false);
  });
  it("only the owning creator can edit a listing", async () => {
    const l = await makeListing({ approve: false }); track(l.user);
    const other = await makeListing({ approve: false }); track(other.user);
    expect((await updateListing(other.user.id, l.listing.id, baseListing({ title: "Hijacked title" }))).ok).toBe(false);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.listing.id } })).title).toBe("Gold Sniper V1");
  });
  it("paid products need real-data evidence with enough trades, a methodology and a data source; synthetic/imported/foreign runs are rejected", async () => {
    const l = await makeListing({ approve: false }); track(l.user);
    const stranger = track(await makeUser());
    expect((await submitForReview(l.user.id, l.listing.id)).ok).toBe(false);
    expect((await submissionProblems(l.listing.id)).join(" ")).toMatch(/at least one backtest on real data/);
    const synth = await makeEvidenceRun(l.user.id, { synthetic: true });
    const imported = await makeEvidenceRun(l.user.id, { kind: "IMPORTED" });
    const optimisation = await makeEvidenceRun(l.user.id, { kind: "OPTIMIZATION" });
    const theirs = await makeEvidenceRun(stranger.id);
    for (const r of [synth, imported, optimisation, theirs]) expect((await attachEvidence(l.user.id, l.listing.id, r.id, "")).ok).toBe(false);
    const small = await makeEvidenceRun(l.user.id, { tradeCount: 5 });
    await attachEvidence(l.user.id, l.listing.id, small.id, "");
    expect((await submitForReview(l.user.id, l.listing.id)).ok).toBe(false); // too few trades
    const good = await makeEvidenceRun(l.user.id);
    expect((await attachEvidence(l.user.id, l.listing.id, good.id, "OOS 2026")).ok).toBe(true);
    expect((await submitForReview(l.user.id, l.listing.id)).ok).toBe(true);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.listing.id } })).status).toBe("PENDING_REVIEW");
    expect((await submitForReview(l.user.id, l.listing.id)).ok).toBe(false); // already submitted
  });
  it("public evidence shows every assumption and never the per-trade rows", async () => {
    const l = await makeListing(); track(l.user);
    const run = await makeEvidenceRun(l.user.id);
    await attachEvidence(l.user.id, l.listing.id, run.id, "OOS");
    const page = (await getListingPage(l.listing.slug, null))!;
    const ev = page.evidence[0];
    expect(ev.run.sampleType).toBe("OUT_OF_SAMPLE");
    expect(ev.run.config).toMatchObject({ symbol: "XAUUSD", timeframe: "H1", initialBalance: 10000, riskPercent: 1, spread: 0.3, slippage: 0.05, commissionPerLot: 3 });
    expect(ev.run.dataSource).toContain("Uploaded CSV");
    expect(ev.run.tradeCount).toBe(120);
    expect(JSON.stringify(ev)).not.toContain("per-trade-row");
  });
  it("only admins can approve/reject/suspend; approval needs a pending, valid listing; rejection needs a reason", async () => {
    const l = await makeListing({ pricing: "FREE", approve: false }); track(l.user);
    const user = { id: l.user.id, role: "USER" as const };
    await expect(reviewListing(user, l.listing.id, "APPROVE")).rejects.toBeInstanceOf(Forbidden);
    const admin = await adminUser(); track({ id: admin.id });
    expect((await reviewListing(admin, l.listing.id, "APPROVE")).ok).toBe(false); // still DRAFT
    expect((await submitForReview(l.user.id, l.listing.id)).ok).toBe(true);
    expect((await reviewListing(admin, l.listing.id, "REJECT", "no")).ok).toBe(false);
    expect((await reviewListing(admin, l.listing.id, "REJECT", "Documentation is too thin to review.")).ok).toBe(true);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.listing.id } })).rejectionReason).toMatch(/too thin/);
    expect((await submitForReview(l.user.id, l.listing.id)).ok).toBe(true); // can resubmit after rejection
    expect((await reviewListing(admin, l.listing.id, "APPROVE")).ok).toBe(true);
    expect(await getListingPage(l.listing.slug, null)).not.toBeNull();
    expect((await reviewListing(admin, l.listing.id, "SUSPEND", "short")).ok).toBe(false);
    expect((await reviewListing(admin, l.listing.id, "SUSPEND", "Misleading marketing claims")).ok).toBe(true);
    expect(await getListingPage(l.listing.slug, null)).toBeNull();
    expect((await reviewListing(admin, l.listing.id, "UNSUSPEND")).ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { actorId: admin.id, targetId: l.listing.id } })).toBe(4); // REJECT, APPROVE, SUSPEND, UNSUSPEND (failed attempts aren't logged)
  });
  it("only admins verify creators", async () => {
    const l = await makeListing(); track(l.user);
    await expect(setCreatorVerified({ id: l.user.id, role: "USER" }, l.creatorId, true)).rejects.toBeInstanceOf(Forbidden);
    const admin = await adminUser(); track({ id: admin.id });
    await setCreatorVerified(admin, l.creatorId, true);
    expect((await getListingPage(l.listing.slug, null))!.creator.verified).toBe(true);
  });
});

describe.skipIf(!hasDb)("platform settings (commission is configurable, not hard-coded)", () => {
  it("only admins change settings; new orders snapshot the new commission while old orders keep theirs", async () => {
    const l = await makeListing({ price: 100, pricing: "ONE_TIME" }); track(l.user);
    const b1 = track(await makeUser()), b2 = track(await makeUser());
    const admin = await adminUser(); track({ id: admin.id });
    await expect(saveMarketSettings({ id: b1.id, role: "USER" }, { commissionPercent: 5 })).rejects.toBeInstanceOf(Forbidden);
    const before = await getMarketSettings();
    const o1 = await buyAndPay(b1.id, l.listing.id);
    try {
      expect((await saveMarketSettings(admin, { commissionPercent: 10 })).ok).toBe(true);
      const o2 = await buyAndPay(b2.id, l.listing.id);
      expect(o1!.commissionPercent).toBe(before.commissionPercent);
      expect(o2!.commissionPercent).toBe(10);
      expect(o2!.creatorEarningUsdCents).toBeGreaterThan(o1!.creatorEarningUsdCents);
      expect((await saveMarketSettings(admin, { commissionPercent: 99 })).ok).toBe(false);
    } finally {
      await saveMarketSettings(admin, { commissionPercent: before.commissionPercent });
    }
  });
});
