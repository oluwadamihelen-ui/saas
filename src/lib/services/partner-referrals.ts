import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { Prisma, Partner } from "@/generated/prisma/client";

/// The only place a Partner's referral code ever ends up in a cookie —
/// never trust partnerId/code values coming back from a form field or any
/// other client-controlled input for attribution purposes. Everything
/// downstream re-resolves the actual Partner server-side from this cookie's
/// (or an explicit Super Admin action's) value.
export const PARTNER_REFERRAL_COOKIE_NAME = "sp_ref";

/// Case-normalized (see Partner.partnerCode's own doc comment) lookup,
/// restricted to ACTIVE partners only — a PENDING/SUSPENDED/REJECTED
/// partner's link must never produce a valid attribution.
export async function resolveActivePartnerByCode(code: string): Promise<Partner | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return prisma.partner.findFirst({ where: { partnerCode: normalized, status: "ACTIVE" } });
}

/// Reads whatever referral cookie the browser sent (set by /r/[code], see
/// that route) and re-resolves it against the live ACTIVE-partner table —
/// the cookie's own natural maxAge (see that route) is what enforces the
/// attribution window; a cookie the browser still has is by construction
/// still inside it. Returns null for the overwhelming majority of
/// registrations, which carry no such cookie at all. Must be called from a
/// Server Action or Route Handler (next/headers requires request scope).
export async function getPendingPartnerReferralFromCookie(): Promise<{ partnerId: string; referralCodeUsed: string } | null> {
  const store = await cookies();
  const code = store.get(PARTNER_REFERRAL_COOKIE_NAME)?.value;
  if (!code) return null;

  const partner = await resolveActivePartnerByCode(code);
  if (!partner) return null;

  return { partnerId: partner.id, referralCodeUsed: code };
}

/// Called once, inside the same transaction that creates the school (see
/// createSchoolWithOwner) — schoolId is @unique on PartnerReferral, so this
/// can only ever run for a brand-new school that has no attribution yet.
/// No-op when `resolved` is null (no referral cookie, or the code in it
/// didn't resolve to an ACTIVE partner) — most schools sign up with no
/// Partner involved at all.
export async function attributeReferralForNewSchool(
  tx: Prisma.TransactionClient,
  schoolId: string,
  resolved: { partnerId: string; referralCodeUsed: string } | null
) {
  if (!resolved) return;
  await tx.partnerReferral.create({
    data: {
      partnerId: resolved.partnerId,
      schoolId,
      source: "LINK",
      referralCodeUsed: resolved.referralCodeUsed,
    },
  });
}

/// Called once, right after a Buyer account is created (see
/// convertInquiryToBuyer) — buyerId is @unique on PartnerReferral, so this
/// can only ever run for a brand-new Buyer that has no attribution yet.
/// No-op when `resolved` is null — most Buyers convert from an inquiry
/// with no Partner involved at all, or the browser that submitted the
/// inquiry never carried a referral cookie by the time conversion happens.
export async function attributeReferralForNewBuyer(
  tx: Prisma.TransactionClient,
  buyerId: string,
  resolved: { partnerId: string; referralCodeUsed: string } | null
) {
  if (!resolved) return;
  await tx.partnerReferral.create({
    data: {
      partnerId: resolved.partnerId,
      buyerId,
      source: "LINK",
      referralCodeUsed: resolved.referralCodeUsed,
    },
  });
}

/// Super Admin sets the very first attribution for a Buyer that currently
/// has none (e.g. the referral cookie didn't survive to conversion time,
/// or the Partner brought them in offline). Mirrors
/// manuallyAttributePartnerReferral exactly, just for a Buyer instead of a
/// School.
export async function manuallyAttributeBuyerReferral(input: { buyerId: string; partnerId: string; attributedById: string }) {
  const existing = await prisma.partnerReferral.findUnique({ where: { buyerId: input.buyerId } });
  if (existing) throw new Error("This Buyer already has a Partner attribution — use the override action to change it.");

  const referral = await prisma.partnerReferral.create({
    data: {
      buyerId: input.buyerId,
      partnerId: input.partnerId,
      source: "MANUAL",
      attributedById: input.attributedById,
    },
  });

  await logAudit({
    schoolId: null,
    userId: input.attributedById,
    action: "partner_referral.attributed_manually",
    resourceType: "PartnerReferral",
    resourceId: referral.id,
    newValue: { partnerId: input.partnerId },
  });

  return referral;
}

/// Corrects an existing Buyer attribution — mirrors overridePartnerReferral
/// exactly.
export async function overrideBuyerReferral(input: { buyerId: string; newPartnerId: string; overriddenById: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to override a Partner attribution.");

  const existing = await prisma.partnerReferral.findUnique({ where: { buyerId: input.buyerId } });
  if (!existing) throw new Error("This Buyer has no existing Partner attribution to override.");
  if (existing.partnerId === input.newPartnerId) throw new Error("This Buyer is already attributed to that Partner.");

  const referral = await prisma.partnerReferral.update({
    where: { buyerId: input.buyerId },
    data: {
      previousPartnerId: existing.partnerId,
      partnerId: input.newPartnerId,
      overriddenAt: new Date(),
      overriddenById: input.overriddenById,
      overrideReason: reason,
    },
  });

  await logAudit({
    schoolId: null,
    userId: input.overriddenById,
    action: "partner_referral.overridden",
    resourceType: "PartnerReferral",
    resourceId: referral.id,
    previousValue: { partnerId: existing.partnerId },
    newValue: { partnerId: input.newPartnerId, reason },
  });

  return referral;
}

/// Super Admin sets the very first attribution for a school that currently
/// has none (e.g. a Partner brought in a school offline and there was never
/// a link click). Fails loudly if a referral already exists — correcting
/// an existing one is a distinct, more consequential action
/// (overridePartnerReferral) that requires a reason.
export async function manuallyAttributePartnerReferral(input: { schoolId: string; partnerId: string; attributedById: string }) {
  const existing = await prisma.partnerReferral.findUnique({ where: { schoolId: input.schoolId } });
  if (existing) throw new Error("This school already has a Partner attribution — use the override action to change it.");

  const referral = await prisma.partnerReferral.create({
    data: {
      schoolId: input.schoolId,
      partnerId: input.partnerId,
      source: "MANUAL",
      attributedById: input.attributedById,
    },
  });

  await logAudit({
    schoolId: input.schoolId,
    userId: input.attributedById,
    action: "partner_referral.attributed_manually",
    resourceType: "PartnerReferral",
    resourceId: referral.id,
    newValue: { partnerId: input.partnerId },
  });

  return referral;
}

/// Corrects an existing attribution to point at a different Partner —
/// updates the one row that has always existed for this school (never
/// inserts a second), keeping the prior partner and the reason on record
/// via previousPartnerId/overriddenAt/overriddenById/overrideReason. A
/// reason is mandatory — this reassigns real, already-flowing commission
/// eligibility away from one Partner and onto another.
export async function overridePartnerReferral(input: { schoolId: string; newPartnerId: string; overriddenById: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("A reason is required to override a Partner attribution.");

  const existing = await prisma.partnerReferral.findUnique({ where: { schoolId: input.schoolId } });
  if (!existing) throw new Error("This school has no existing Partner attribution to override.");
  if (existing.partnerId === input.newPartnerId) throw new Error("This school is already attributed to that Partner.");

  const referral = await prisma.partnerReferral.update({
    where: { schoolId: input.schoolId },
    data: {
      previousPartnerId: existing.partnerId,
      partnerId: input.newPartnerId,
      overriddenAt: new Date(),
      overriddenById: input.overriddenById,
      overrideReason: reason,
    },
  });

  await logAudit({
    schoolId: input.schoolId,
    userId: input.overriddenById,
    action: "partner_referral.overridden",
    resourceType: "PartnerReferral",
    resourceId: referral.id,
    previousValue: { partnerId: existing.partnerId },
    newValue: { partnerId: input.newPartnerId, reason },
  });

  return referral;
}
