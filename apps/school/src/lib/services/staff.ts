import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const INVITE_TTL_DAYS = 7;

export async function listRoles(schoolId: string) {
  return prisma.role.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
}

export async function listStaff(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPendingInvites(schoolId: string) {
  return prisma.staffInvite.findMany({
    where: { schoolId, status: "PENDING" },
    include: { role: true, invitedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function inviteStaffMember(schoolId: string, invitedById: string, email: string, roleId: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) throw new Error(`${normalizedEmail} already has an account.`);

  const role = await prisma.role.findFirst({ where: { id: roleId, schoolId } });
  if (!role) throw new Error("Select a valid role.");

  const token = crypto.randomBytes(24).toString("hex");

  return prisma.staffInvite.upsert({
    where: { schoolId_email_status: { schoolId, email: normalizedEmail, status: "PENDING" } },
    create: {
      schoolId,
      email: normalizedEmail,
      roleId,
      token,
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {
      roleId,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

export async function getInviteByToken(token: string) {
  return prisma.staffInvite.findUnique({
    where: { token },
    include: { school: true, role: true },
  });
}

export async function acceptInvite(token: string, input: { name: string; password: string }) {
  const invite = await prisma.staffInvite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") throw new Error("This invite is no longer valid.");
  if (invite.expiresAt < new Date()) {
    await prisma.staffInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    throw new Error("This invite has expired.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId: invite.schoolId,
        roleId: invite.roleId,
        email: invite.email,
        passwordHash,
        name: input.name,
      },
    });
    await tx.staffInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    return user;
  });
}
