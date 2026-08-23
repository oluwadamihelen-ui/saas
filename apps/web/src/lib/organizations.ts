import { randomBytes } from "node:crypto";
import { organizationInviteEmail } from "@cinerra/email";
import { prisma } from "./db";
import { emailClient } from "./email";
import { env } from "./env";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class NotStudioPlanError extends Error {
  constructor() {
    super("Creating a studio team requires a plan with more than one seat.");
  }
}
export class AlreadyInOrganizationError extends Error {
  constructor() {
    super("You're already part of an organization.");
  }
}
export class NotOrganizationOwnerError extends Error {
  constructor() {
    super("Only the organization's owner can do that.");
  }
}
export class OwnerCannotLeaveError extends Error {
  constructor() {
    super("As the owner, you can't leave your own organization yet — remove members or delete your account instead.");
  }
}
export class SeatLimitReachedError extends Error {
  constructor() {
    super("You've used all the seats on your plan. Remove a member or upgrade to invite more.");
  }
}
export class AlreadyMemberOrInvitedError extends Error {
  constructor() {
    super("That person is already a member or has a pending invite.");
  }
}
export class InvalidInviteError extends Error {
  constructor() {
    super("This invite link is invalid or has expired.");
  }
}
export class InviteEmailMismatchError extends Error {
  constructor() {
    super("Please sign in with the email address this invite was sent to.");
  }
}

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "studio";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

async function getPlanSeats(userId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({ where: { userId }, include: { plan: true } });
  return subscription?.plan.seats ?? 1;
}

/** Creating a team requires a plan with more than one seat (the "studio" plan in the seeded data — seats, not the plan key, is the actual gate). */
export async function createOrganization(userId: string, name: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.organizationId) throw new AlreadyInOrganizationError();

  const seats = await getPlanSeats(userId);
  if (seats <= 1) throw new NotStudioPlanError();

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name, slug: slugify(name), ownerId: userId } });
    await tx.user.update({ where: { id: userId }, data: { organizationId: organization.id } });
    return organization;
  });
}

export async function getOrganizationForUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      organization: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: { select: { id: true, name: true, email: true }, orderBy: { createdAt: "asc" } },
          invites: { where: { acceptedAt: null }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!user.organization) return null;

  const seats = await getPlanSeats(user.organization.ownerId);
  return { ...user.organization, seats };
}

/** Invite-by-email, owner-only. Best-effort send — a failed or unconfigured email provider doesn't undo the invite record itself. */
export async function inviteToOrganization(ownerId: string, email: string): Promise<void> {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, include: { ownedOrganization: true } });
  const organization = owner.ownedOrganization;
  if (!organization) throw new NotOrganizationOwnerError();

  const normalizedEmail = email.toLowerCase();
  const seats = await getPlanSeats(ownerId);

  const [memberCount, existingInvite, existingMember] = await Promise.all([
    prisma.user.count({ where: { organizationId: organization.id } }),
    prisma.organizationInvite.findUnique({ where: { organizationId_email: { organizationId: organization.id, email: normalizedEmail } } }),
    prisma.user.findFirst({ where: { organizationId: organization.id, email: normalizedEmail } }),
  ]);
  if (existingMember || (existingInvite && !existingInvite.acceptedAt)) throw new AlreadyMemberOrInvitedError();
  if (memberCount >= seats) throw new SeatLimitReachedError();

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.organizationInvite.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: normalizedEmail } },
    create: { organizationId: organization.id, email: normalizedEmail, invitedByName: owner.name ?? owner.email, token, expiresAt },
    update: { token, expiresAt, acceptedAt: null, invitedByName: owner.name ?? owner.email },
  });

  const acceptUrl = `${env.APP_BASE_URL}/studio/invite?token=${token}`;
  await emailClient
    .send({
      to: normalizedEmail,
      ...organizationInviteEmail({ organizationName: organization.name, inviterName: owner.name ?? owner.email, acceptUrl }),
    })
    .catch((err) => console.error("[email] Failed to send organization invite email:", err));
}

export async function acceptOrganizationInvite(userId: string, token: string): Promise<void> {
  const invite = await prisma.organizationInvite.findUnique({ where: { token }, include: { organization: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw new InvalidInviteError();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) throw new InviteEmailMismatchError();
  if (user.organizationId) throw new AlreadyInOrganizationError();

  const seats = await getPlanSeats(invite.organization.ownerId);
  const memberCount = await prisma.user.count({ where: { organizationId: invite.organizationId } });
  if (memberCount >= seats) throw new SeatLimitReachedError();

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { organizationId: invite.organizationId } }),
    prisma.organizationInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
}

/** The owner removing someone else, or any member removing themselves ("leave"). The owner can't remove themselves — no ownership-transfer flow exists yet. */
export async function removeOrganizationMember(callerId: string, memberIdToRemove: string): Promise<void> {
  const caller = await prisma.user.findUniqueOrThrow({ where: { id: callerId }, include: { ownedOrganization: true } });
  const member = await prisma.user.findUniqueOrThrow({ where: { id: memberIdToRemove } });

  const isSelf = callerId === memberIdToRemove;
  const isOwnerActingOnOwnOrg = Boolean(caller.ownedOrganization) && member.organizationId === caller.ownedOrganization?.id;

  if (!isSelf && !isOwnerActingOnOwnOrg) throw new NotOrganizationOwnerError();
  if (isSelf && caller.ownedOrganization) throw new OwnerCannotLeaveError();

  await prisma.user.update({ where: { id: memberIdToRemove }, data: { organizationId: null } });
}
