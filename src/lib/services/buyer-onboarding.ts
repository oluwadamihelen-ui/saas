import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ensureBuyerRole } from "@/lib/platform-provisioning";
import { logAudit } from "@/lib/audit";
import { attributeReferralForNewBuyer } from "@/lib/services/partner-referrals";

function generateTemporaryPassword() {
  // 16 hex chars from 8 random bytes — well above the 8-char minimum used
  // everywhere else in this app, and never derived from anything guessable.
  return crypto.randomBytes(8).toString("hex");
}

/// The only way a Buyer account is created: a Super Admin, after an actual
/// sales conversation, converts an EnterpriseInquiry into one. Unlike
/// Partner's self-serve application, a Buyer never sets their own password
/// at signup — there's no email provider in this app (see StaffInvite's own
/// doc comments), so a one-time temporary password is generated here and
/// returned to the caller to show ONCE and hand to the Super Admin to share
/// with the buyer themselves; it is never stored or retrievable again after
/// this call returns.
export async function convertInquiryToBuyer(input: { inquiryId: string; createdById: string; displayName: string; phone?: string | null }) {
  const inquiry = await prisma.enterpriseInquiry.findUnique({ where: { id: input.inquiryId } });
  if (!inquiry) throw new Error("Inquiry not found.");

  const existingBuyer = await prisma.buyer.findUnique({ where: { sourceInquiryId: inquiry.id } });
  if (existingBuyer) throw new Error("This inquiry has already been converted to a Buyer account.");

  const email = inquiry.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("An account with this email already exists.");

  const role = await ensureBuyerRole();
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  // Re-validated here, not just trusted from when the inquiry was
  // submitted — the referred Partner could have been suspended in the
  // (often long) gap between inquiry and conversion.
  let referral: { partnerId: string; referralCodeUsed: string } | null = null;
  if (inquiry.referredByPartnerId) {
    const partner = await prisma.partner.findFirst({ where: { id: inquiry.referredByPartnerId, status: "ACTIVE" } });
    if (partner) referral = { partnerId: partner.id, referralCodeUsed: inquiry.referralCodeUsed ?? partner.partnerCode };
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { schoolId: null, roleId: role.id, email, name: input.displayName, passwordHash },
    });
    const buyer = await tx.buyer.create({
      data: {
        userId: user.id,
        displayName: input.displayName,
        phone: input.phone?.trim() || null,
        sourceInquiryId: inquiry.id,
        createdById: input.createdById,
      },
    });
    await attributeReferralForNewBuyer(tx, buyer.id, referral);
    await tx.enterpriseInquiry.update({
      where: { id: inquiry.id },
      data: { status: "CONVERTED", reviewedById: input.createdById, reviewedAt: new Date() },
    });
    return { user, buyer };
  });

  await logAudit({
    schoolId: null,
    userId: input.createdById,
    action: "buyer.converted_from_inquiry",
    resourceType: "Buyer",
    resourceId: result.buyer.id,
    newValue: { inquiryId: inquiry.id, email },
  });

  return { ...result, temporaryPassword };
}

export async function suspendBuyer(buyerId: string, suspendedById: string, reason: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to suspend a Buyer.");

  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new Error("Buyer not found.");
  if (buyer.status !== "ACTIVE") throw new Error("Only an active Buyer can be suspended.");

  const updated = await prisma.buyer.update({
    where: { id: buyerId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedById, suspensionReason: trimmedReason },
  });
  await logAudit({
    schoolId: null,
    userId: suspendedById,
    action: "buyer.suspended",
    resourceType: "Buyer",
    resourceId: buyerId,
    newValue: { reason: trimmedReason },
  });
  return updated;
}

export async function reactivateBuyer(buyerId: string, reactivatedById: string) {
  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new Error("Buyer not found.");
  if (buyer.status !== "SUSPENDED") throw new Error("Only a suspended Buyer can be reactivated.");

  const updated = await prisma.buyer.update({ where: { id: buyerId }, data: { status: "ACTIVE" } });
  await logAudit({ schoolId: null, userId: reactivatedById, action: "buyer.reactivated", resourceType: "Buyer", resourceId: buyerId });
  return updated;
}

/// The temporary password from convertInquiryToBuyer is shown exactly
/// once and never stored anywhere retrievable — if a Super Admin loses it
/// before copying it to the buyer, there is no way to recover the
/// original. This issues a brand-new one, same one-time-reveal contract,
/// so credentials can always be re-sent without needing a forgot-password
/// email flow this app doesn't have.
export async function resetBuyerPassword(buyerId: string, resetById: string) {
  const buyer = await prisma.buyer.findUnique({ where: { id: buyerId }, include: { user: true } });
  if (!buyer) throw new Error("Buyer not found.");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await prisma.user.update({ where: { id: buyer.userId }, data: { passwordHash } });

  await logAudit({ schoolId: null, userId: resetById, action: "buyer.password_reset", resourceType: "Buyer", resourceId: buyerId });

  return { email: buyer.user.email, temporaryPassword };
}

export async function listBuyersForPlatform() {
  return prisma.buyer.findMany({
    include: { user: true, sourceInquiry: true, _count: { select: { agreements: true, invoices: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBuyerForPlatform(id: string) {
  return prisma.buyer.findUnique({
    where: { id },
    include: {
      user: true,
      sourceInquiry: true,
      referral: { include: { partner: true } },
      agreements: { include: { partner: true, progressUpdates: { orderBy: { postedAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
}
