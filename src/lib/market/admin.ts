import "server-only";
import { prisma } from "@/lib/db";
import { cleanText } from "@/lib/sanitize";
import { assertAdmin, audit, type Actor } from "./admin-core";
import { submissionProblems } from "./listings";
import { slugify } from "./listings";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export async function adminOverview(actor: Actor) {
  assertAdmin(actor);
  const [pending, listings, creators, orders, openReports, payoutsOpen, gross, platform] = await Promise.all([
    prisma.listing.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.listing.count({ where: { status: "APPROVED" } }),
    prisma.creator.count(),
    prisma.marketOrder.count({ where: { status: "PAID" } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.payout.count({ where: { status: { in: ["REQUESTED", "PROCESSING"] } } }),
    prisma.marketOrder.aggregate({ where: { status: "PAID" }, _sum: { grossUsdCents: true } }),
    prisma.marketOrder.aggregate({ where: { status: "PAID" }, _sum: { platformFeeUsdCents: true } }),
  ]);
  return { pending, listings, creators, orders, openReports, payoutsOpen, grossCents: gross._sum.grossUsdCents ?? 0, platformFeeCents: platform._sum.platformFeeUsdCents ?? 0 };
}

export async function reviewListing(actor: Actor, listingId: string, decision: "APPROVE" | "REJECT" | "SUSPEND" | "UNSUSPEND", reason = ""): Promise<Result<object>> {
  assertAdmin(actor);
  const l = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!l) return fail("Listing not found.");
  const note = cleanText(reason, 1000);
  if (decision === "APPROVE") {
    if (l.status !== "PENDING_REVIEW") return fail("Only listings pending review can be approved.");
    const problems = await submissionProblems(listingId);
    if (problems.length) return fail(`Can't approve yet: ${problems[0]}`);
    await prisma.listing.update({ where: { id: listingId }, data: { status: "APPROVED", approvedAt: new Date(), rejectionReason: null } });
  } else if (decision === "REJECT") {
    if (l.status !== "PENDING_REVIEW") return fail("Only listings pending review can be rejected.");
    if (note.length < 10) return fail("Give the creator a reason (at least 10 characters).");
    await prisma.listing.update({ where: { id: listingId }, data: { status: "REJECTED", rejectionReason: note } });
  } else if (decision === "SUSPEND") {
    if (l.status !== "APPROVED") return fail("Only approved listings can be suspended.");
    if (note.length < 10) return fail("Give a reason (at least 10 characters).");
    await prisma.listing.update({ where: { id: listingId }, data: { status: "SUSPENDED", rejectionReason: note } });
  } else {
    if (l.status !== "SUSPENDED") return fail("This listing isn't suspended.");
    await prisma.listing.update({ where: { id: listingId }, data: { status: "APPROVED", rejectionReason: null } });
  }
  await audit(actor, `LISTING_${decision}`, "listing", listingId, { reason: note });
  return { ok: true };
}

export async function setCreatorVerified(actor: Actor, creatorId: string, verified: boolean) {
  assertAdmin(actor);
  await prisma.creator.update({ where: { id: creatorId }, data: { verified } });
  await audit(actor, verified ? "CREATOR_VERIFY" : "CREATOR_UNVERIFY", "creator", creatorId);
}

export async function setCreatorStatus(actor: Actor, creatorId: string, status: "ACTIVE" | "SUSPENDED") {
  assertAdmin(actor);
  await prisma.creator.update({ where: { id: creatorId }, data: { status } });
  await audit(actor, `CREATOR_${status}`, "creator", creatorId);
}

export async function verifyPayoutMethod(actor: Actor, creatorId: string) {
  assertAdmin(actor);
  await prisma.creator.update({ where: { id: creatorId }, data: { payoutVerifiedAt: new Date() } });
  await audit(actor, "PAYOUT_METHOD_VERIFY", "creator", creatorId);
}

export async function processPayout(actor: Actor, payoutId: string, outcome: "PAID" | "FAILED" | "CANCELED", reference = ""): Promise<Result<object>> {
  assertAdmin(actor);
  const p = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!p) return fail("Payout not found.");
  if (p.status !== "REQUESTED" && p.status !== "PROCESSING") return fail("This payout was already processed.");
  if (outcome === "PAID" && cleanText(reference, 100).length < 3) return fail("Enter the transfer reference.");
  const r = await prisma.payout.updateMany({ where: { id: payoutId, status: { in: ["REQUESTED", "PROCESSING"] } }, data: { status: outcome, reference: cleanText(reference, 100) || null, processedAt: new Date() } });
  if (!r.count) return fail("This payout was already processed.");
  await audit(actor, `PAYOUT_${outcome}`, "payout", payoutId, { amountUsdCents: p.amountUsdCents, reference });
  return { ok: true };
}

export async function resolveReport(actor: Actor, reportId: string, action: "DISMISS" | "HIDE_REVIEW" | "SUSPEND_LISTING", note = ""): Promise<Result<object>> {
  assertAdmin(actor);
  const r = await prisma.report.findUnique({ where: { id: reportId } });
  if (!r || r.status !== "OPEN") return fail("Report not found or already handled.");
  if (action === "HIDE_REVIEW" && r.reviewId) await prisma.review.update({ where: { id: r.reviewId }, data: { status: "HIDDEN" } });
  if (action === "SUSPEND_LISTING" && r.listingId) await prisma.listing.updateMany({ where: { id: r.listingId, status: "APPROVED" }, data: { status: "SUSPENDED", rejectionReason: cleanText(note, 500) || "Suspended after a report." } });
  await prisma.report.update({ where: { id: reportId }, data: { status: action === "DISMISS" ? "DISMISSED" : "RESOLVED", resolution: cleanText(note, 500) || action, resolvedAt: new Date() } });
  await audit(actor, `REPORT_${action}`, "report", reportId, { note });
  return { ok: true };
}

export async function saveCategory(actor: Actor, c: { id?: string; name: string; sort?: number; active?: boolean }): Promise<Result<object>> {
  assertAdmin(actor);
  const name = cleanText(c.name, 40);
  if (name.length < 2) return fail("Enter a category name.");
  if (c.id) await prisma.category.update({ where: { id: c.id }, data: { name, sort: c.sort ?? 0, active: c.active ?? true } });
  else {
    const slug = slugify(name);
    if (await prisma.category.findUnique({ where: { slug } })) return fail("That category already exists.");
    await prisma.category.create({ data: { slug, name, sort: c.sort ?? 99 } });
  }
  await audit(actor, "CATEGORY_SAVE", "category", c.id ?? name);
  return { ok: true };
}
