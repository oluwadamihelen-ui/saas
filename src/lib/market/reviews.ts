import "server-only";
import { prisma } from "@/lib/db";
import { cleanText } from "@/lib/sanitize";
import { canReview } from "./licensing";
import { assertAdmin, audit, type Actor } from "./admin-core";
import { rateLimit } from "@/lib/rate-limit";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export async function submitReview(userId: string, listingId: string, r: { rating: number; title: string; body: string }): Promise<Result<object>> {
  if (!rateLimit(`review:${userId}`, 10, 10 * 60_000).ok) return fail("Too many reviews. Try again later.");
  if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) return fail("Choose a rating from 1 to 5.");
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, status: true, creator: { select: { userId: true } } } });
  if (!listing || listing.status === "DRAFT") return fail("Product not found.");
  const license = await prisma.license.findUnique({ where: { userId_listingId: { userId, listingId } } });
  const order = license?.orderId ? await prisma.marketOrder.findUnique({ where: { id: license.orderId }, select: { status: true } }) : null;
  const gate = canReview({ userId, creatorUserId: listing.creator.userId, license });
  if (!gate.ok) return fail(gate.reason ?? "You can't review this product.");
  // "Verified purchase" = a paid order; free access is shown as a verified user, not a purchaser.
  const verifiedPurchase = !!license && license.type !== "FREE" && order?.status === "PAID";
  const data = { rating: r.rating, title: cleanText(r.title, 100), body: cleanText(r.body, 2000), verifiedPurchase };
  await prisma.review.upsert({ where: { listingId_userId: { listingId, userId } }, create: { listingId, userId, ...data }, update: { ...data, status: "VISIBLE" } });
  return { ok: true };
}

export async function reportContent(reporterId: string, t: { listingId?: string; reviewId?: string; reason: string; details: string }): Promise<Result<object>> {
  if (!rateLimit(`report:${reporterId}`, 10, 60 * 60_000).ok) return fail("Too many reports. Try again later.");
  if (!t.listingId && !t.reviewId) return fail("Nothing to report.");
  const reason = cleanText(t.reason, 60);
  if (!reason) return fail("Choose a reason.");
  if (t.listingId && !(await prisma.listing.findUnique({ where: { id: t.listingId }, select: { id: true } }))) return fail("Product not found.");
  if (t.reviewId && !(await prisma.review.findUnique({ where: { id: t.reviewId }, select: { id: true } }))) return fail("Review not found.");
  await prisma.report.create({ data: { reporterId, listingId: t.listingId ?? null, reviewId: t.reviewId ?? null, reason, details: cleanText(t.details, 1000) } });
  return { ok: true };
}

export async function setReviewStatus(actor: Actor, reviewId: string, status: "VISIBLE" | "HIDDEN") {
  assertAdmin(actor);
  await prisma.review.update({ where: { id: reviewId }, data: { status } });
  await audit(actor, status === "HIDDEN" ? "REVIEW_HIDE" : "REVIEW_SHOW", "review", reviewId);
}
