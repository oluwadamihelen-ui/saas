import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Prisma, Gender } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";

const INVITE_TTL_DAYS = 7;

export async function listRoles(schoolId: string) {
  return prisma.role.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

/// Every system role except the two that a normal "add a staff member"
/// flow should never offer: SCHOOL_OWNER (immutable outside a dedicated
/// ownership-transfer flow — out of scope here) and the portal-only
/// PARENT/STUDENT roles (created through enrollment/guardian linking, not
/// this form). Used by Direct Creation, bulk registration, and Change
/// Role's assignable-role list alike, so all three stay in sync.
export async function listAssignableRoles(schoolId: string) {
  const roles = await listRoles(schoolId);
  return roles.filter((r) => !["SCHOOL_OWNER", "PARENT", "STUDENT"].includes(r.key));
}

const STAFF_PAGE_SIZE = 20;

/// Excludes PARENT/STUDENT portal accounts — this is the staff directory,
/// not every login this school has ever issued.
export async function listStaff(schoolId: string, page = 1) {
  const currentPage = Math.max(1, page);
  const where: Prisma.UserWhereInput = { schoolId, role: { key: { notIn: ["PARENT", "STUDENT"] } } };
  const [staff, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * STAFF_PAGE_SIZE,
      take: STAFF_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  return { staff, total, page: currentPage, pageCount: Math.max(1, Math.ceil(total / STAFF_PAGE_SIZE)) };
}

/// Unpaginated, for dropdowns (payroll structure assignment, book loan
/// borrower picker, etc.) rather than the main directory table — a
/// school's staff count is bounded the same way its class/fee-structure
/// lists are.
export async function listAllStaff(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId, role: { key: { notIn: ["PARENT", "STUDENT"] } } },
    include: { role: true },
    orderBy: { name: "asc" },
  });
}

export async function listPendingInvites(schoolId: string) {
  return prisma.staffInvite.findMany({
    where: { schoolId, status: "PENDING" },
    include: { role: true, invitedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

/// The one place a StaffInvite row is ever written to after creation.
/// Keyed on the same (schoolId, email, PENDING) slot the schema's unique
/// constraint enforces, so re-inviting an email, converting a pending
/// invite to Direct Creation, and regenerating a password-setup link all
/// update the SAME row in place rather than leaving old ones behind —
/// the previous token simply stops matching any row the instant a new
/// one overwrites it, so at most one link per person is ever valid.
async function upsertPendingInvite(
  schoolId: string,
  invitedById: string,
  email: string,
  roleId: string,
  purpose: "ACCOUNT_INVITATION" | "PASSWORD_SETUP",
  userId: string | null
) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return prisma.staffInvite.upsert({
    where: { schoolId_email_status: { schoolId, email, status: "PENDING" } },
    create: { schoolId, email, roleId, token, invitedById, expiresAt, purpose, userId },
    update: { roleId, token, expiresAt, purpose, userId },
  });
}

export async function inviteStaffMember(schoolId: string, invitedById: string, email: string, roleId: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) throw new Error(`${normalizedEmail} already has an account.`);

  const role = await prisma.role.findFirst({ where: { id: roleId, schoolId } });
  if (!role) throw new Error("Select a valid role.");

  const invite = await upsertPendingInvite(schoolId, invitedById, normalizedEmail, roleId, "ACCOUNT_INVITATION", null);

  await logAudit({
    schoolId,
    userId: invitedById,
    action: "staff.invited",
    resourceType: "StaffInvite",
    resourceId: invite.id,
    newValue: { email: normalizedEmail, roleId },
  });

  return invite;
}

export async function getInviteByToken(token: string) {
  return prisma.staffInvite.findUnique({
    where: { token },
    include: { school: true, role: true, user: true },
  });
}

export async function acceptInvite(token: string, input: { name?: string; password: string }) {
  const invite = await prisma.staffInvite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") throw new Error("This invite is no longer valid.");
  if (invite.expiresAt < new Date()) {
    await prisma.staffInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    throw new Error("This invite has expired.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    let user;
    if (invite.userId) {
      // PASSWORD_SETUP: the account already exists (Direct Creation, or a
      // pending invite that was converted to one) — just activate it.
      // Nothing about name/role/staffId changes here.
      user = await tx.user.update({
        where: { id: invite.userId },
        data: { passwordHash, status: "ACTIVE" },
      });
    } else {
      // ACCOUNT_INVITATION: original behavior, unchanged — the account is
      // created for the first time, right now, from what the invitee enters.
      if (!input.name?.trim()) throw new Error("Name is required.");
      user = await tx.user.create({
        data: { schoolId: invite.schoolId, roleId: invite.roleId, email: invite.email, passwordHash, name: input.name.trim() },
      });
    }
    await tx.staffInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    return user;
  });
}

export interface StaffDuplicateCheck {
  existingUser: { id: string; name: string; email: string } | null;
  pendingInvite: { id: string; email: string; purpose: string } | null;
  staffIdConflict: { id: string; name: string } | null;
}

/// Shared by Direct Creation, the pending-invite conversion, and bulk
/// registration's row validation — one place that decides whether an
/// email/staffId combination is safe to create, so all three modes reject
/// duplicates the same way.
export async function checkStaffDuplicate(schoolId: string, email: string, staffId?: string | null): Promise<StaffDuplicateCheck> {
  const normalizedEmail = email.toLowerCase().trim();
  const [existingUser, pendingInvite, staffIdConflict] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, name: true, email: true } }),
    prisma.staffInvite.findFirst({
      where: { schoolId, email: normalizedEmail, status: "PENDING" },
      select: { id: true, email: true, purpose: true },
    }),
    staffId
      ? prisma.user.findFirst({ where: { schoolId, staffId }, select: { id: true, name: true } })
      : Promise.resolve(null),
  ]);
  return { existingUser, pendingInvite, staffIdConflict };
}

export interface DirectCreateStaffInput {
  name: string;
  email: string;
  roleId: string;
  phone?: string | null;
  staffId?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  gender?: Gender | null;
}

/// A cryptographically random, never-shared, never-usable password. The
/// account can't authenticate through it anyway — status stays INVITED
/// until password setup completes, and auth.ts's authorize() already
/// rejects any non-ACTIVE user outright, so this hash never needs to be
/// guessed against; it exists only because passwordHash is NOT NULL.
async function placeholderPasswordHash() {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
}

/// Creates the User immediately (status INVITED — see auth.ts) and a
/// PASSWORD_SETUP invite/link for it in the same operation. The admin
/// copies invite.token into a /invite/[token] link and shares it with the
/// staff member directly — there is no email provider in this system, so
/// nothing is "sent" on the account's behalf.
export async function createStaffDirect(schoolId: string, createdById: string, input: DirectCreateStaffInput) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const trimmedStaffId = input.staffId?.trim() || null;

  const dup = await checkStaffDuplicate(schoolId, normalizedEmail, trimmedStaffId);
  if (dup.existingUser) throw new Error(`${normalizedEmail} already has an account.`);
  if (dup.pendingInvite) throw new Error(`${normalizedEmail} already has a pending invitation.`);
  if (dup.staffIdConflict) throw new Error(`Staff ID "${trimmedStaffId}" is already in use.`);

  const role = await prisma.role.findFirst({ where: { id: input.roleId, schoolId } });
  if (!role) throw new Error("Select a valid role.");
  if (role.key === "SCHOOL_OWNER") throw new Error("School Owner cannot be assigned here.");

  const passwordHash = await placeholderPasswordHash();

  const user = await prisma.user.create({
    data: {
      schoolId,
      roleId: input.roleId,
      email: normalizedEmail,
      passwordHash,
      name: input.name.trim(),
      status: "INVITED",
      phone: input.phone?.trim() || null,
      staffId: trimmedStaffId,
      jobTitle: input.jobTitle?.trim() || null,
      department: input.department?.trim() || null,
      gender: input.gender ?? null,
    },
    include: { role: true },
  });

  const invite = await upsertPendingInvite(schoolId, createdById, normalizedEmail, input.roleId, "PASSWORD_SETUP", user.id);

  await logAudit({
    schoolId,
    userId: createdById,
    action: "staff.created_direct",
    resourceType: "User",
    resourceId: user.id,
    newValue: { email: normalizedEmail, name: user.name, roleId: input.roleId, staffId: trimmedStaffId },
  });
  await logAudit({
    schoolId,
    userId: createdById,
    action: "staff.password_setup_link_created",
    resourceType: "StaffInvite",
    resourceId: invite.id,
    newValue: { userId: user.id },
  });

  return { user, invite };
}

/// Regenerates a staff member's password-setup link — e.g. their first one
/// expired, or the admin lost track of it. Reuses the same PENDING row
/// (see upsertPendingInvite), so the old link stops working the instant
/// this returns, not just eventually.
export async function regeneratePasswordSetupLink(schoolId: string, actingUserId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
  if (!user) throw new Error("User not found.");
  if (user.status !== "INVITED") throw new Error("This account has already completed password setup.");

  const invite = await upsertPendingInvite(schoolId, actingUserId, user.email, user.roleId, "PASSWORD_SETUP", user.id);

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "staff.password_setup_link_created",
    resourceType: "StaffInvite",
    resourceId: invite.id,
    newValue: { userId: user.id, regenerated: true },
  });

  return invite;
}

export interface ConvertInviteInput {
  name: string;
  phone?: string | null;
  staffId?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  gender?: Gender | null;
}

/// "Create Account Now" on a pending ACCOUNT_INVITATION row: creates the
/// User immediately (same as Direct Creation) using the invite's existing
/// email/role, then converts that SAME invite row into a PASSWORD_SETUP
/// link for the new account — never a second row, never a duplicate User.
export async function convertInviteToDirect(schoolId: string, actingUserId: string, inviteId: string, input: ConvertInviteInput) {
  const invite = await prisma.staffInvite.findFirst({
    where: { id: inviteId, schoolId, status: "PENDING", purpose: "ACCOUNT_INVITATION" },
  });
  if (!invite) throw new Error("This invitation is no longer pending, or has already been converted.");

  const trimmedStaffId = input.staffId?.trim() || null;
  const dup = await checkStaffDuplicate(schoolId, invite.email, trimmedStaffId);
  if (dup.existingUser) throw new Error(`${invite.email} already has an account.`);
  if (dup.staffIdConflict) throw new Error(`Staff ID "${trimmedStaffId}" is already in use.`);

  const passwordHash = await placeholderPasswordHash();

  const user = await prisma.user.create({
    data: {
      schoolId,
      roleId: invite.roleId,
      email: invite.email,
      passwordHash,
      name: input.name.trim(),
      status: "INVITED",
      phone: input.phone?.trim() || null,
      staffId: trimmedStaffId,
      jobTitle: input.jobTitle?.trim() || null,
      department: input.department?.trim() || null,
      gender: input.gender ?? null,
    },
  });

  const newInvite = await upsertPendingInvite(schoolId, actingUserId, invite.email, invite.roleId, "PASSWORD_SETUP", user.id);

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "staff.invite_converted_to_direct",
    resourceType: "User",
    resourceId: user.id,
    previousValue: { inviteId: invite.id },
    newValue: { email: invite.email, name: user.name },
  });

  return { user, invite: newInvite };
}
