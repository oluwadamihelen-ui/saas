import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ensurePartnerRole } from "@/lib/platform-provisioning";
import { logAudit } from "@/lib/audit";

function codeBase(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return base || "PARTNER";
}

async function uniquePartnerCode(name: string) {
  const base = codeBase(name);
  let code = base;
  let attempt = 0;
  while (await prisma.partner.findUnique({ where: { partnerCode: code } })) {
    attempt += 1;
    code = `${base}${Math.floor(1000 + Math.random() * 9000)}${attempt > 1 ? attempt : ""}`;
  }
  return code;
}

/// Self-serve application — creates the User+Partner row immediately at
/// PENDING (spec: "so they can log in and see a status page"), never
/// requiring a Super Admin action just to get an account that exists.
/// Approval (see approvePartnerApplication in the platform admin service)
/// is what actually flips status to ACTIVE and unlocks the real dashboard.
export async function applyAsPartner(input: { displayName: string; email: string; phone?: string | null; password: string }) {
  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with this email already exists.");

  const role = await ensurePartnerRole();
  const partnerCode = await uniquePartnerCode(input.displayName);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { schoolId: null, roleId: role.id, email, name: input.displayName, passwordHash },
    });
    const partner = await tx.partner.create({
      data: { userId: user.id, partnerCode, displayName: input.displayName, phone: input.phone?.trim() || null },
    });
    return { user, partner };
  });

  await logAudit({
    schoolId: null,
    userId: result.user.id,
    action: "partner.applied",
    resourceType: "Partner",
    resourceId: result.partner.id,
    newValue: { partnerCode },
  });

  return result;
}

export async function approvePartnerApplication(partnerId: string, approvedById: string) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new Error("Partner not found.");
  if (partner.status !== "PENDING") throw new Error("Only a pending application can be approved.");

  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: { status: "ACTIVE", approvedAt: new Date(), approvedById },
  });
  await logAudit({ schoolId: null, userId: approvedById, action: "partner.approved", resourceType: "Partner", resourceId: partnerId });
  return updated;
}

export async function rejectPartnerApplication(partnerId: string, rejectedById: string, reason: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to reject an application.");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new Error("Partner not found.");
  if (partner.status !== "PENDING") throw new Error("Only a pending application can be rejected.");

  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectedById, rejectionReason: trimmedReason },
  });
  await logAudit({
    schoolId: null,
    userId: rejectedById,
    action: "partner.rejected",
    resourceType: "Partner",
    resourceId: partnerId,
    newValue: { reason: trimmedReason },
  });
  return updated;
}

export async function suspendPartner(partnerId: string, suspendedById: string, reason: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to suspend a Partner.");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new Error("Partner not found.");
  if (partner.status !== "ACTIVE") throw new Error("Only an active Partner can be suspended.");

  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedById, suspensionReason: trimmedReason },
  });
  await logAudit({
    schoolId: null,
    userId: suspendedById,
    action: "partner.suspended",
    resourceType: "Partner",
    resourceId: partnerId,
    newValue: { reason: trimmedReason },
  });
  return updated;
}

export async function listPartnersForPlatform() {
  return prisma.partner.findMany({
    include: { user: true, _count: { select: { referrals: true, agreements: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPartnerForPlatform(id: string) {
  return prisma.partner.findUnique({
    where: { id },
    include: {
      user: true,
      referrals: { include: { school: true, buyer: true }, orderBy: { attributedAt: "desc" } },
      agreements: { include: { school: true }, orderBy: { createdAt: "desc" } },
      buyerAgreements: { include: { buyer: true }, orderBy: { createdAt: "desc" } },
      withdrawals: { orderBy: { requestedAt: "desc" } },
      _count: { select: { commissions: true } },
    },
  });
}

/// The suspension's own audit fields (suspendedAt/By/reason) are left in
/// place as history of the last suspension — only status flips back.
export async function reactivatePartner(partnerId: string, reactivatedById: string) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new Error("Partner not found.");
  if (partner.status !== "SUSPENDED") throw new Error("Only a suspended Partner can be reactivated.");

  const updated = await prisma.partner.update({ where: { id: partnerId }, data: { status: "ACTIVE" } });
  await logAudit({ schoolId: null, userId: reactivatedById, action: "partner.reactivated", resourceType: "Partner", resourceId: partnerId });
  return updated;
}
