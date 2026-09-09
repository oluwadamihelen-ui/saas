import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const INVITE_TTL_DAYS = 14;

async function assertEmailIsFree(email: string) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error(`${email} already has an account.`);
}

/// User.email is still the DB column NextAuth's credentials authorize()
/// ultimately loads the account by — it must stay globally unique and
/// non-null (schema) — but for a student who logs in with their admission
/// number instead (see auth.ts's authorize(), which resolves
/// admissionNumber+schoolSlug to a user before ever touching this column),
/// nobody ever needs to type or remember this value, so it's just an opaque
/// internal placeholder rather than anything derived from the student's own
/// admission number.
function generatePlaceholderLogin(): string {
  return `student-${crypto.randomBytes(12).toString("hex")}@portal.internal`;
}

export async function listPortalInvitesForGuardian(schoolId: string, guardianId: string) {
  return prisma.portalInvite.findMany({
    where: { schoolId, guardianId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPortalInvitesForStudent(schoolId: string, studentId: string) {
  return prisma.portalInvite.findMany({
    where: { schoolId, studentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function inviteGuardianToPortal(
  schoolId: string,
  invitedById: string,
  guardianId: string,
  email: string,
) {
  const normalizedEmail = email.toLowerCase().trim();

  const guardian = await prisma.guardian.findFirst({ where: { id: guardianId, schoolId } });
  if (!guardian) throw new Error("Guardian not found.");
  if (guardian.userId) throw new Error("This guardian already has a portal account.");

  await assertEmailIsFree(normalizedEmail);

  const token = crypto.randomBytes(24).toString("hex");

  return prisma.portalInvite.upsert({
    where: { schoolId_email_status: { schoolId, email: normalizedEmail, status: "PENDING" } },
    create: {
      schoolId,
      type: "GUARDIAN",
      guardianId,
      email: normalizedEmail,
      token,
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {
      guardianId,
      studentId: null,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

/// email is optional here (unlike inviteGuardianToPortal, where a guardian
/// is always an adult) — a young student with no email address of their
/// own can be invited with it omitted, and will log in with their
/// admission number + school instead of an email once the invite is
/// accepted (see the "Student login" tab on the login page, and
/// authorize() in src/auth.ts). Either way the underlying account still
/// gets a real User.email value — the schema requires one, and it's what
/// PortalInvite itself is keyed on — it's simply never shown to the
/// student as their credential when it's a generated placeholder.
export async function inviteStudentToPortal(
  schoolId: string,
  invitedById: string,
  studentId: string,
  email?: string,
) {
  const normalizedEmail = email ? email.toLowerCase().trim() : generatePlaceholderLogin();

  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw new Error("Student not found.");
  if (student.userId) throw new Error("This student already has a portal account.");

  await assertEmailIsFree(normalizedEmail);

  const token = crypto.randomBytes(24).toString("hex");

  return prisma.portalInvite.upsert({
    where: { schoolId_email_status: { schoolId, email: normalizedEmail, status: "PENDING" } },
    create: {
      schoolId,
      type: "STUDENT",
      studentId,
      email: normalizedEmail,
      token,
      invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {
      studentId,
      guardianId: null,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

export async function getPortalInviteByToken(token: string) {
  return prisma.portalInvite.findUnique({
    where: { token },
    include: { school: true, guardian: true, student: true },
  });
}

export async function acceptPortalInvite(token: string, input: { name: string; password: string }) {
  const invite = await prisma.portalInvite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") throw new Error("This invite is no longer valid.");
  if (invite.expiresAt < new Date()) {
    await prisma.portalInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    throw new Error("This invite has expired.");
  }

  const role = await prisma.role.findFirst({
    where: { schoolId: invite.schoolId, key: invite.type === "GUARDIAN" ? "PARENT" : "STUDENT" },
  });
  if (!role) throw new Error("Portal role is not set up for this school.");

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        schoolId: invite.schoolId,
        roleId: role.id,
        email: invite.email,
        passwordHash,
        name: input.name,
      },
    });

    if (invite.type === "GUARDIAN" && invite.guardianId) {
      await tx.guardian.update({ where: { id: invite.guardianId }, data: { userId: user.id } });
    } else if (invite.type === "STUDENT" && invite.studentId) {
      await tx.student.update({ where: { id: invite.studentId }, data: { userId: user.id } });
    }

    await tx.portalInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
    return user;
  });
}
